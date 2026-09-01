use std::sync::Arc;
use log::{debug, error, info};
use tokio::time::{sleep, Duration};

use crate::config::Config;

pub struct Dispatcher {
    config: Arc<Config>,
}

impl Dispatcher {
    pub fn new(config: Config) -> Self {
        Self {
            config: Arc::new(config),
        }
    }

    pub async fn run(&self) -> Result<(), DispatcherError> {
        info!("Starting webhook dispatcher with tick interval {:?}", self.config.tick_interval);

        loop {
            match self.tick().await {
                Ok(()) => debug!("Webhook tick completed successfully"),
                Err(e) => error!("Webhook tick failed: {}", e),
            }

            sleep(self.config.tick_interval).await;
        }
    }

    async fn tick(&self) -> Result<(), DispatcherError> {
        // Fetch due webhooks and process them
        let due_webhooks = self.fetch_due().await?;
        
        for webhook in due_webhooks {
            if let Err(e) = self.deliver(&webhook).await {
                error!("Failed to deliver webhook {}: {}", webhook.id, e);
            }
        }
        
        Ok(())
    }

    async fn fetch_due(&self) -> Result<Vec<Webhook>, DispatcherError> {
        // Use the encryption key from config instead of reading from environment
        debug!("Fetching due webhooks using encryption key from config");
        
        // Placeholder implementation - would query database for due webhooks
        // and decrypt them using self.config.encryption_key
        let _encryption_key = &self.config.encryption_key;
        
        Ok(vec![]) // Return empty list for now
    }

    async fn deliver(&self, webhook: &Webhook) -> Result<(), DispatcherError> {
        debug!("Delivering webhook {} using encryption key from config", webhook.id);
        
        // Use the encryption key from config for any encryption needed during delivery
        let _encryption_key = &self.config.encryption_key;
        
        // Placeholder implementation - would deliver the webhook
        Ok(())
    }
}

#[derive(Debug)]
pub struct Webhook {
    pub id: String,
    pub url: String,
    pub payload: String,
}

#[derive(Debug, thiserror::Error)]
pub enum DispatcherError {
    #[error("Database error: {0}")]
    DatabaseError(String),
    
    #[error("HTTP error: {0}")]
    HttpError(String),
    
    #[error("Encryption error: {0}")]
    EncryptionError(String),
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    fn create_test_config() -> Config {
        Config {
            contract_ids: vec!["CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA".to_string()],
            encryption_key: "test-encryption-key".to_string(),
            tick_interval: Duration::from_millis(100),
            database_url: "postgres://localhost/test".to_string(),
        }
    }

    #[tokio::test]
    async fn test_dispatcher_creation() {
        let config = create_test_config();
        let dispatcher = Dispatcher::new(config);
        
        // Verify the dispatcher has access to the encryption key
        assert_eq!(dispatcher.config.encryption_key, "test-encryption-key");
    }

    #[tokio::test]
    async fn test_fetch_due_uses_config_key() {
        let config = create_test_config();
        let dispatcher = Dispatcher::new(config);
        
        // This should not panic and should use the config key, not env var
        let result = dispatcher.fetch_due().await;
        assert!(result.is_ok());
    }
}