/// Validates that a string is a valid Stellar contract ID (C-strkey format)
pub fn is_valid_contract_id(contract_id: &str) -> bool {
    // Basic validation: C-strkey format
    // Contract IDs start with 'C' and are 56 characters long
    // Full validation would include StrKey decoding and checksum verification
    contract_id.starts_with('C') && contract_id.len() == 56 && contract_id.chars().all(|c| c.is_ascii_alphanumeric())
}

/// Validates a list of contract IDs and returns the first invalid one, if any
pub fn validate_contract_ids(contract_ids: &[String]) -> Result<(), String> {
    for contract_id in contract_ids {
        if !is_valid_contract_id(contract_id) {
            return Err(format!("Invalid contract ID: {}", contract_id));
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_contract_id() {
        let valid_id = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
        assert!(is_valid_contract_id(valid_id));
    }

    #[test]
    fn test_invalid_contract_id_wrong_prefix() {
        let invalid_id = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
        assert!(!is_valid_contract_id(invalid_id));
    }

    #[test]
    fn test_invalid_contract_id_wrong_length() {
        let invalid_id = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
        assert!(!is_valid_contract_id(invalid_id));
    }

    #[test]
    fn test_validate_contract_ids_success() {
        let contract_ids = vec![
            "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA".to_string(),
            "CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB".to_string(),
        ];
        assert!(validate_contract_ids(&contract_ids).is_ok());
    }

    #[test]
    fn test_validate_contract_ids_failure() {
        let contract_ids = vec![
            "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA".to_string(),
            "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB".to_string(), // Invalid G-strkey
        ];
        assert!(validate_contract_ids(&contract_ids).is_err());
    }
}