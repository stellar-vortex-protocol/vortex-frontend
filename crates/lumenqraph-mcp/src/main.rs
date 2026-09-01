use std::env;
use log::{info, error};

mod tools;
mod rpc;

use rpc::McpServer;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    env_logger::init();

    info!("Starting Lumenqraph MCP server");

    // Validate contract IDs at startup
    let contract_ids = env::var("CONTRACT_IDS")
        .map_err(|_| "Missing CONTRACT_IDS environment variable")?
        .split(',')
        .map(|id| id.trim().to_string())
        .collect::<Vec<_>>();

    if let Err(e) = lumenqraph_core::validate_contract_ids(&contract_ids) {
        error!("Invalid contract IDs at startup: {}", e);
        std::process::exit(1);
    }

    info!("Contract IDs validation passed: {} contracts configured", contract_ids.len());

    // Create and start MCP server
    let mut server = McpServer::new();
    
    info!("MCP server started, handling stdio");
    server.handle_stdio().await?;
    
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;
    use std::process::Command;
    use std::io::Write;
    use std::time::Duration;
    use tokio::process::Command as TokioCommand;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    #[tokio::test]
    async fn test_startup_validation_success() {
        env::set_var("CONTRACT_IDS", "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA,CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB");
        
        let contract_ids = env::var("CONTRACT_IDS")
            .unwrap()
            .split(',')
            .map(|id| id.trim().to_string())
            .collect::<Vec<_>>();

        assert!(lumenqraph_core::validate_contract_ids(&contract_ids).is_ok());
        
        env::remove_var("CONTRACT_IDS");
    }

    #[tokio::test]
    async fn test_startup_validation_failure() {
        env::set_var("CONTRACT_IDS", "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA,INVALID_ID");
        
        let contract_ids = env::var("CONTRACT_IDS")
            .unwrap()
            .split(',')
            .map(|id| id.trim().to_string())
            .collect::<Vec<_>>();

        assert!(lumenqraph_core::validate_contract_ids(&contract_ids).is_err());
        
        env::remove_var("CONTRACT_IDS");
    }

    #[tokio::test]
    async fn test_mcp_server_integration_initialize() {
        // Test the MCP server can handle an initialize request
        let mut server = crate::rpc::McpServer::new();
        
        let input = r#"{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}}"#;
        let response = server.handle_request(input).await.unwrap();
        
        assert!(response.is_some());
        let response_json: serde_json::Value = serde_json::from_str(&response.unwrap()).unwrap();
        assert_eq!(response_json["id"], 1);
        assert!(response_json.get("result").is_some());
    }

    #[tokio::test]
    async fn test_mcp_server_integration_full_protocol() {
        // Test the full initialize -> tools/list -> tools/call flow
        let mut server = crate::rpc::McpServer::new();
        
        // Step 1: Initialize
        let init_request = r#"{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}}"#;
        let init_response = server.handle_request(init_request).await.unwrap();
        assert!(init_response.is_some());
        
        let init_json: serde_json::Value = serde_json::from_str(&init_response.unwrap()).unwrap();
        assert!(init_json.get("result").is_some());
        
        // Step 2: List tools
        let list_request = r#"{"jsonrpc": "2.0", "id": 2, "method": "tools/list"}"#;
        let list_response = server.handle_request(list_request).await.unwrap();
        assert!(list_response.is_some());
        
        let list_json: serde_json::Value = serde_json::from_str(&list_response.unwrap()).unwrap();
        let tools = &list_json["result"]["tools"];
        assert!(tools.is_array());
        assert!(tools.as_array().unwrap().len() > 0);
        
        // Step 3: Call a tool
        let call_request = r#"{"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {"name": "search_intents", "arguments": {"query": "test"}}}"#;
        let call_response = server.handle_request(call_request).await.unwrap();
        assert!(call_response.is_some());
        
        let call_json: serde_json::Value = serde_json::from_str(&call_response.unwrap()).unwrap();
        assert!(call_json.get("result").is_some());
    }

    #[tokio::test]
    async fn test_mcp_server_error_handling() {
        let mut server = crate::rpc::McpServer::new();
        
        // Test malformed JSON
        let malformed_request = r#"{"invalid": json}"#;
        let response = server.handle_request(malformed_request).await.unwrap();
        assert!(response.is_some());
        
        let response_json: serde_json::Value = serde_json::from_str(&response.unwrap()).unwrap();
        assert!(response_json.get("error").is_some());
        
        // Test unknown method
        let unknown_method_request = r#"{"jsonrpc": "2.0", "id": 1, "method": "unknown_method"}"#;
        let response = server.handle_request(unknown_method_request).await.unwrap();
        assert!(response.is_some());
        
        let response_json: serde_json::Value = serde_json::from_str(&response.unwrap()).unwrap();
        assert!(response_json.get("error").is_some());
        
        // Test tools/call without initialization
        let call_request = r#"{"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {"name": "search_intents", "arguments": {"query": "test"}}}"#;
        let response = server.handle_request(call_request).await.unwrap();
        assert!(response.is_some());
        
        let response_json: serde_json::Value = serde_json::from_str(&response.unwrap()).unwrap();
        assert!(response_json.get("error").is_some());
    }

    #[tokio::test]
    async fn test_mcp_server_missing_required_fields() {
        let mut server = crate::rpc::McpServer::new();
        
        // Initialize first
        let init_request = r#"{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}}"#;
        server.handle_request(init_request).await.unwrap();
        
        // Test tools/call with missing tool name
        let missing_name_request = r#"{"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {"arguments": {"query": "test"}}}"#;
        let response = server.handle_request(missing_name_request).await.unwrap();
        assert!(response.is_some());
        
        let response_json: serde_json::Value = serde_json::from_str(&response.unwrap()).unwrap();
        assert!(response_json.get("error").is_some());
        
        // Test tools/call with missing required argument
        let missing_arg_request = r#"{"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {"name": "search_intents", "arguments": {}}}"#;
        let response = server.handle_request(missing_arg_request).await.unwrap();
        assert!(response.is_some());
        
        let response_json: serde_json::Value = serde_json::from_str(&response.unwrap()).unwrap();
        assert!(response_json.get("error").is_some());
    }
}