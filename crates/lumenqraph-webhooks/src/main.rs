use log::{info, error};

mod config;
mod dispatcher;

use config::Config;
use dispatcher::Dispatcher;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    env_logger::init();

    info!("Starting Lumenqraph Webhooks service");

    // Load and validate configuration at startup
    let config = Config::from_env().map_err(|e| {
        error!("Configuration error: {}", e);
        e
    })?;

    info!("Configuration loaded successfully");
    info!("Encryption key configured: {}", if config.encryption_key.is_empty() { "NO" } else { "YES" });
    info!("Contract IDs configured: {}", config.contract_ids.len());

    // Create and start dispatcher
    let dispatcher = Dispatcher::new(config);
    
    info!("Webhook dispatcher starting");
    dispatcher.run().await?;
    
    Ok(())
}

#[cfg(test)]
mod tests {
    use std::env;

    #[tokio::test]
    async fn test_service_startup_with_valid_config() {
        env::set_var("CONTRACT_IDS", "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
        env::set_var("WEBHOOK_ENCRYPTION_KEY", "test-key-123");
        env::set_var("DATABASE_URL", "postgres://localhost/test");
        
        let config_result = crate::config::Config::from_env();
        assert!(config_result.is_ok());
        
        env::remove_var("CONTRACT_IDS");
        env::remove_var("WEBHOOK_ENCRYPTION_KEY");
        env::remove_var("DATABASE_URL");
    }

    #[tokio::test]
    async fn test_service_startup_fails_with_missing_key() {
        env::set_var("CONTRACT_IDS", "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
        env::set_var("DATABASE_URL", "postgres://localhost/test");
        // Deliberately not setting WEBHOOK_ENCRYPTION_KEY
        
        let config_result = crate::config::Config::from_env();
        assert!(config_result.is_err());
        
        env::remove_var("CONTRACT_IDS");
        env::remove_var("DATABASE_URL");
    }
}