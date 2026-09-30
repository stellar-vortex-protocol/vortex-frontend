# Contract review specs

The review decoder uses the versioned specs in `src/lib/contractSpecs`. When a settlement or solver-registry contract is upgraded, regenerate the entries from the contract build and update the environment contract IDs together. Unknown contract IDs and functions are rejected before signing.
