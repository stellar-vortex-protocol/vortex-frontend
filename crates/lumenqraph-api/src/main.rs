use std::env;
use log::{info, error};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    env_logger::init();

    info!("Starting Lumenqraph API service");

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

    // Start API server (placeholder implementation)
    info!("API service started successfully");
    
    // Keep the service running
    tokio::signal::ctrl_c().await?;
    info!("Shutting down API service");
    
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

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
}