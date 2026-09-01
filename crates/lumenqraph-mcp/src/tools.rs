use serde_json::{Value, json};
use std::collections::HashMap;

#[derive(Debug)]
pub struct McpTool {
    pub name: String,
    pub description: String,
    pub input_schema: Value,
}

pub struct ToolRegistry {
    tools: HashMap<String, McpTool>,
}

impl ToolRegistry {
    pub fn new() -> Self {
        let mut registry = Self {
            tools: HashMap::new(),
        };
        
        // Register built-in tools
        registry.register_tool(McpTool {
            name: "search_intents".to_string(),
            description: "Search for intents in the Lumenqraph database".to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search query for intents"
                    },
                    "limit": {
                        "type": "number",
                        "description": "Maximum number of results to return",
                        "default": 10
                    }
                },
                "required": ["query"]
            }),
        });

        registry.register_tool(McpTool {
            name: "get_solver_stats".to_string(),
            description: "Get statistics for a specific solver".to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "solver_id": {
                        "type": "string",
                        "description": "The solver ID to get stats for"
                    }
                },
                "required": ["solver_id"]
            }),
        });

        registry
    }

    pub fn register_tool(&mut self, tool: McpTool) {
        self.tools.insert(tool.name.clone(), tool);
    }

    pub fn list_tools(&self) -> Vec<&McpTool> {
        self.tools.values().collect()
    }

    pub fn get_tool(&self, name: &str) -> Option<&McpTool> {
        self.tools.get(name)
    }

    pub async fn call_tool(&self, name: &str, arguments: Value) -> Result<Value, ToolError> {
        match name {
            "search_intents" => self.search_intents(arguments).await,
            "get_solver_stats" => self.get_solver_stats(arguments).await,
            _ => Err(ToolError::UnknownTool(name.to_string())),
        }
    }

    async fn search_intents(&self, arguments: Value) -> Result<Value, ToolError> {
        let query = arguments.get("query")
            .and_then(|v| v.as_str())
            .ok_or_else(|| ToolError::MissingArgument("query".to_string()))?;

        let limit = arguments.get("limit")
            .and_then(|v| v.as_u64())
            .unwrap_or(10);

        // Placeholder implementation
        Ok(json!({
            "results": [],
            "query": query,
            "limit": limit,
            "total": 0
        }))
    }

    async fn get_solver_stats(&self, arguments: Value) -> Result<Value, ToolError> {
        let solver_id = arguments.get("solver_id")
            .and_then(|v| v.as_str())
            .ok_or_else(|| ToolError::MissingArgument("solver_id".to_string()))?;

        // Placeholder implementation
        Ok(json!({
            "solver_id": solver_id,
            "total_fills": 0,
            "success_rate": 0.0,
            "uptime": "0s"
        }))
    }
}

#[derive(Debug, thiserror::Error)]
pub enum ToolError {
    #[error("Unknown tool: {0}")]
    UnknownTool(String),
    
    #[error("Missing required argument: {0}")]
    MissingArgument(String),
    
    #[error("Invalid argument: {0}")]
    InvalidArgument(String),
    
    #[error("Tool execution failed: {0}")]
    ExecutionFailed(String),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tool_registry_creation() {
        let registry = ToolRegistry::new();
        let tools = registry.list_tools();
        assert_eq!(tools.len(), 2);
        
        let tool_names: Vec<&str> = tools.iter().map(|t| t.name.as_str()).collect();
        assert!(tool_names.contains(&"search_intents"));
        assert!(tool_names.contains(&"get_solver_stats"));
    }

    #[tokio::test]
    async fn test_search_intents_tool() {
        let registry = ToolRegistry::new();
        let args = json!({
            "query": "test query",
            "limit": 5
        });

        let result = registry.call_tool("search_intents", args).await;
        assert!(result.is_ok());
        
        let response = result.unwrap();
        assert_eq!(response["query"], "test query");
        assert_eq!(response["limit"], 5);
    }

    #[tokio::test]
    async fn test_get_solver_stats_tool() {
        let registry = ToolRegistry::new();
        let args = json!({
            "solver_id": "solver123"
        });

        let result = registry.call_tool("get_solver_stats", args).await;
        assert!(result.is_ok());
        
        let response = result.unwrap();
        assert_eq!(response["solver_id"], "solver123");
    }

    #[tokio::test]
    async fn test_unknown_tool_error() {
        let registry = ToolRegistry::new();
        let args = json!({});

        let result = registry.call_tool("unknown_tool", args).await;
        assert!(result.is_err());
        
        match result.unwrap_err() {
            ToolError::UnknownTool(name) => assert_eq!(name, "unknown_tool"),
            _ => panic!("Expected UnknownTool error"),
        }
    }

    #[tokio::test]
    async fn test_missing_argument_error() {
        let registry = ToolRegistry::new();
        let args = json!({}); // Missing required "query" argument

        let result = registry.call_tool("search_intents", args).await;
        assert!(result.is_err());
        
        match result.unwrap_err() {
            ToolError::MissingArgument(arg) => assert_eq!(arg, "query"),
            _ => panic!("Expected MissingArgument error"),
        }
    }
}