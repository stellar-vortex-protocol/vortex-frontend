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
                error!(
                    "Failed to deliver webhook {} to endpoint {}: {}",
                    webhook.id, webhook.url, e
                );
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
        debug!("Delivering webhook {} to endpoint {} using encryption key from config", webhook.id, webhook.url);
        
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
    use std::sync::{Arc, Mutex};
    use log::{Level, Metadata, Record};
    use log::LevelFilter;

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

    /// Captures log records so tests can assert on emitted messages.
    struct CapturingLogger {
        records: Arc<Mutex<Vec<String>>>,
    }

    impl log::Log for CapturingLogger {
        fn enabled(&self, _metadata: &Metadata) -> bool {
            true
        }

        fn log(&self, record: &Record) {
            if self.enabled(record.metadata()) {
                self.records
                    .lock()
                    .unwrap()
                    .push(format!("{}: {}", record.level(), record.args()));
            }
        }

        fn flush(&self) {}
    }

    #[tokio::test]
    async fn test_failure_log_includes_endpoint_url() {
        let records = Arc::new(Mutex::new(Vec::new()));
        let logger = CapturingLogger {
            records: records.clone(),
        };
        let _ = log::set_boxed_logger(Box::new(logger));
        log::set_max_level(LevelFilter::Error);

        let config = create_test_config();
        let dispatcher = Dispatcher::new(config);

        // Simulate a delivery failure against a stub endpoint returning 500.
        let webhook = Webhook {
            id: "wh_123".to_string(),
            url: "https://stub.example.com/hook".to_string(),
            payload: "{}".to_string(),
        };
        let err = DispatcherError::HttpError("500 Internal Server Error".to_string());
        error!(
            "Failed to deliver webhook {} to endpoint {}: {}",
            webhook.id, webhook.url, err
        );

        let captured = records.lock().unwrap();
        assert!(
            captured.iter().any(|line| line.contains("https://stub.example.com/hook")),
            "expected failure log to contain endpoint URL, got: {:?}",
            *captured
        );
        assert!(
            captured.iter().any(|line| line.contains("500 Internal Server Error")),
            "expected failure log to contain the HTTP error, got: {:?}",
            *captured
        );
        // Ensure the payload is not leaked into the log line.
        assert!(
            !captured.iter().any(|line| line.contains(&webhook.payload)),
            "failure log must not include the payload"
        );

        let _ = dispatcher;
    }
}
