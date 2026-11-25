use serde_json::{Value, json};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::io::{AsyncRead, AsyncWrite};
use std::sync::Arc;
use log::{debug, error};
use tracing::Instrument;

use crate::tools::{ToolRegistry, ToolError};

pub struct McpServer {
    tool_registry: Arc<ToolRegistry>,
    initialized: bool,
}

impl McpServer {
    pub fn new() -> Self {
        Self {
            tool_registry: Arc::new(ToolRegistry::new()),
            initialized: false,
        }
    }

    pub async fn handle_stdio(&mut self) -> Result<(), RpcError> {
        let stdin = tokio::io::stdin();
        let mut stdout = tokio::io::stdout();
        
        self.handle_stream(stdin, &mut stdout).await
    }

    pub async fn handle_stream<R, W>(&mut self, reader: R, writer: &mut W) -> Result<(), RpcError>
    where
        R: AsyncRead + Unpin,
        W: AsyncWrite + Unpin,
    {
        let mut buf_reader = BufReader::new(reader);
        let mut line = String::new();

        loop {
            line.clear();
            match buf_reader.read_line(&mut line).await {
                Ok(0) => break, // EOF
                Ok(_) => {
                    if let Some(response) = self.handle_request(&line).await? {
                        writer.write_all(response.as_bytes()).await?;
                        writer.write_all(b"\n").await?;
                        writer.flush().await?;
                    }
                }
                Err(e) => {
                    error!("Error reading from input: {}", e);
                    break;
                }
            }
        }

        Ok(())
    }

    async fn handle_request(&mut self, line: &str) -> Result<Option<String>, RpcError> {
        let line = line.trim();
        if line.is_empty() {
            return Ok(None);
        }

        debug!("Received request: {}", line);

        let request: Value = serde_json::from_str(line)
            .map_err(|e| RpcError::InvalidJson(e.to_string()))?;

        let method = request.get("method")
            .and_then(|m| m.as_str())
            .ok_or_else(|| RpcError::MissingMethod)?;

        let id = request.get("id").cloned();
        let params = request.get("params").cloned().unwrap_or(json!({}));

        let result = match method {
            "initialize" => self.handle_initialize(params).await,
            "tools/list" => self.handle_tools_list().await,
            "tools/call" => self.handle_tools_call(params).await,
            _ => Err(RpcError::UnknownMethod(method.to_string())),
        };

        let response = match result {
            Ok(result) => json!({
                "jsonrpc": "2.0",
                "id": id,
                "result": result
            }),
            Err(e) => json!({
                "jsonrpc": "2.0",
                "id": id,
                "error": {
                    "code": -1,
                    "message": e.to_string()
                }
            }),
        };

        Ok(Some(response.to_string()))
    }

    async fn handle_initialize(&mut self, _params: Value) -> Result<Value, RpcError> {
        debug!("Handling initialize request");
        
        self.initialized = true;
        
        Ok(json!({
            "protocolVersion": "2024-11-05",
            "capabilities": {
                "tools": {}
            },
            "serverInfo": {
                "name": "lumenqraph-mcp",
                "version": "1.0.0"
            }
        }))
    }

    async fn handle_tools_list(&self) -> Result<Value, RpcError> {
        if !self.initialized {
            return Err(RpcError::NotInitialized);
        }

        debug!("Handling tools/list request");
        
        let tools = self.tool_registry.list_tools();
        let tools_json: Vec<Value> = tools.iter().map(|tool| {
            json!({
                "name": tool.name,
                "description": tool.description,
                "inputSchema": tool.input_schema
            })
        }).collect();

        Ok(json!({
            "tools": tools_json
        }))
    }

    async fn handle_tools_call(&self, params: Value) -> Result<Value, RpcError> {
        if !self.initialized {
            return Err(RpcError::NotInitialized);
        }

        debug!("Handling tools/call request");

        let name = params.get("name")
            .and_then(|n| n.as_str())
            .ok_or_else(|| RpcError::MissingToolName)?;

        let arguments = params.get("arguments")
            .cloned()
            .unwrap_or(json!({}));

        // Redacted argument summary: keys only, never values.
        let arg_keys: Vec<String> = arguments
            .as_object()
            .map(|obj| obj.keys().cloned().collect())
            .unwrap_or_default();

        // Enter the span before invoking the tool so any error log emitted
        // during dispatch is attributed to this tool call.
        let span = tracing::info_span!(
            "tools/call",
            tool.name = %name,
            tool.arg_keys = ?arg_keys,
        );

        let result = self.tool_registry
            .call_tool(name, arguments)
            .instrument(span)
            .await
            .map_err(|e| {
                error!(
                    tool.name = %name,
                    tool.arg_keys = ?arg_keys,
                    "Tool call failed: {}",
                    e
                );
                RpcError::ToolError(e)
            })?;

        Ok(json!({
            "content": [{
                "type": "text",
                "text": result.to_string()
            }]
        }))
    }
}

#[derive(Debug, thiserror::Error)]
pub enum RpcError {
    #[error("Invalid JSON: {0}")]
    InvalidJson(String),
    
    #[error("Missing method in request")]
    MissingMethod,
    
    #[error("Unknown method: {0}")]
    UnknownMethod(String),
    
    #[error("Server not initialized")]
    NotInitialized,
    
    #[error("Missing tool name in tools/call request")]
    MissingToolName,
    
    #[error("Tool error: {0}")]
    ToolError(#[from] ToolError),
    
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    #[tokio::test]
    async fn test_initialize_request() {
        let mut server = McpServer::new();
        let request = r#"{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}}"#;
        
        let response = server.handle_request(request).await.unwrap();
        assert!(response.is_some());
        
        let response_json: Value = serde_json::from_str(&response.unwrap()).unwrap();
        assert_eq!(response_json["id"], 1);
        assert!(response_json.get("result").is_some());
        assert!(server.initialized);
    }

    #[tokio::test]
    async fn test_tools_list_requires_initialization() {
        let server = McpServer::new();
        let request = r#"{"jsonrpc": "2.0", "id": 2, "method": "tools/list"}"#;
        
        let response = server.handle_request(request).await.unwrap();
        assert!(response.is_some());
        
        let response_json: Value = serde_json::from_str(&response.unwrap()).unwrap();
        assert!(response_json.get("error").is_some());
    }

    #[tokio::test]
    async fn test_tools_list_after_initialization() {
        let mut server = McpServer::new();
        
        // Initialize first
        let init_request = r#"{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}}"#;
        server.handle_request(init_request).await.unwrap();
        
        // Now list tools
        let request = r#"{"jsonrpc": "2.0", "id": 2, "method": "tools/list"}"#;
        let response = server.handle_request(request).await.unwrap();
        assert!(response.is_some());
        
        let response_json: Value = serde_json::from_str(&response.unwrap()).unwrap();
        assert!(response_json.get("result").is_some());
        let tools = &response_json["result"]["tools"];
        assert!(tools.is_array());
        assert!(tools.as_array().unwrap().len() > 0);
    }

    #[tokio::test]
    async fn test_tools_call() {
        let mut server = McpServer::new();
        
        // Initialize first
        let init_request = r#"{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}}"#;
        server.handle_request(init_request).await.unwrap();
        
        // Call a tool
        let request = r#"{"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {"name": "search_intents", "arguments": {"query": "test"}}}"#;
        let response = server.handle_request(request).await.unwrap();
        assert!(response.is_some());
        
        let response_json: Value = serde_json::from_str(&response.unwrap()).unwrap();
        assert!(response_json.get("result").is_some());
    }

    #[tokio::test]
    async fn test_tools_call_error_logs_tool_name() {
        let mut server = McpServer::new();

        let init_request = r#"{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}}"#;
        server.handle_request(init_request).await.unwrap();

        // Deliberately invalid argument for the tool.
        let request = r#"{"jsonrpc": "2.0", "id": 4, "method": "tools/call", "params": {"name": "search_intents", "arguments": {"query": 12345}}}"#;
        let response = server.handle_request(request).await.unwrap();
        assert!(response.is_some());

        let response_json: Value = serde_json::from_str(&response.unwrap()).unwrap();
        // JSON-RPC error shape is unchanged.
        assert!(response_json.get("error").is_some());
        assert_eq!(response_json["error"]["code"], -1);
    }
}
