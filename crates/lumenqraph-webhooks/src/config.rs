use std::env;
use std::time::Duration;

#[derive(Debug, Clone)]
pub struct Config {
    pub contract_ids: Vec<String>,
    pub encryption_key: String,
    pub tick_interval: Duration,
    pub database_url: String,
}

impl Config {
    pub fn from_env() -> Result<Self, ConfigError> {
        let contract_ids = env::var("CONTRACT_IDS")
            .map_err(|_| ConfigError::MissingContractIds)?
            .split(',')
            .map(|id| id.trim().to_string())
            .collect::<Vec<_>>();

        // Validate contract IDs using the core validation
        lumenqraph_core::validate_contract_ids(&contract_ids)
            .map_err(|e| ConfigError::InvalidContractId(e))?;

        let encryption_key = env::var("WEBHOOK_ENCRYPTION_KEY")
            .map_err(|_| ConfigError::MissingEncryptionKey)?;

        // Fail fast if the key is the testing default in production
        if encryption_key == "default-key-for-testing" && env::var("ENVIRONMENT").unwrap_or_default() == "production" {
            return Err(ConfigError::UnsafeEncryptionKey);
        }

        let tick_interval_secs = env::var("WEBHOOK_TICK_INTERVAL_SECS")
            .unwrap_or_else(|_| "3".to_string())
            .parse::<u64>()
            .map_err(ConfigError::InvalidTickInterval)?;

        let database_url = env::var("DATABASE_URL")
            .map_err(|_| ConfigError::MissingDatabaseUrl)?;

        Ok(Config {
            contract_ids,
            encryption_key,
            tick_interval: Duration::from_secs(tick_interval_secs),
            database_url,
        })
    }
}

#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    #[error("Missing CONTRACT_IDS environment variable")]
    MissingContractIds,
    
    #[error("Invalid contract ID: {0}")]
    InvalidContractId(String),
    
    #[error("Missing WEBHOOK_ENCRYPTION_KEY environment variable")]
    MissingEncryptionKey,
    
    #[error("Unsafe encryption key detected in production environment")]
    UnsafeEncryptionKey,
    
    #[error("Invalid WEBHOOK_TICK_INTERVAL_SECS: {0}")]
    InvalidTickInterval(#[source] std::num::ParseIntError),
    
    #[error("Missing DATABASE_URL environment variable")]
    MissingDatabaseUrl,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_validation_success() {
        env::set_var("CONTRACT_IDS", "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
        env::set_var("WEBHOOK_ENCRYPTION_KEY", "secure-key-123");
        env::set_var("DATABASE_URL", "postgres://localhost/test");
        
        let result = Config::from_env();
        assert!(result.is_ok());
        
        env::remove_var("CONTRACT_IDS");
        env::remove_var("WEBHOOK_ENCRYPTION_KEY");
        env::remove_var("DATABASE_URL");
    }

    #[test]
    fn test_config_validation_invalid_contract_id() {
        env::set_var("CONTRACT_IDS", "INVALID_ID");
        env::set_var("WEBHOOK_ENCRYPTION_KEY", "secure-key-123");
        env::set_var("DATABASE_URL", "postgres://localhost/test");
        
        let result = Config::from_env();
        assert!(result.is_err());
        
        env::remove_var("CONTRACT_IDS");
        env::remove_var("WEBHOOK_ENCRYPTION_KEY");
        env::remove_var("DATABASE_URL");
    }

    #[test]
    fn test_config_validation_unsafe_key_in_production() {
        env::set_var("CONTRACT_IDS", "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
        env::set_var("WEBHOOK_ENCRYPTION_KEY", "default-key-for-testing");
        env::set_var("DATABASE_URL", "postgres://localhost/test");
        env::set_var("ENVIRONMENT", "production");
        
        let result = Config::from_env();
        assert!(result.is_err());
        
        env::remove_var("CONTRACT_IDS");
        env::remove_var("WEBHOOK_ENCRYPTION_KEY");
        env::remove_var("DATABASE_URL");
        env::remove_var("ENVIRONMENT");
    }
}