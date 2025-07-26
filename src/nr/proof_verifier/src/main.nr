use aztec::macros::aztec;

#[aztec]
pub contract ProofVerifier {
    use aztec::macros::{functions::{initializer, public}, storage::storage};
    use bb_proof_verification as bb;

    #[storage]
    struct Storage<Context> {}

    #[public]
    #[initializer]
    fn constructor() {}

    global PROOFS_LEN: u32 = 7; // this is the max number of proofs I tested that can be verified in a single `#[public] fn`. Changing to 8 causes an error "app_logic_reverted. Reason: "

    #[public]
    fn aggregate_proofs(
        vk: bb::UltraHonkVerificationKey,
        proofs: [bb::UltraHonkProof; PROOFS_LEN],
        key_hash: Field,
    ) {
        for i in 0..PROOFS_LEN {
            bb::verify_ultrahonk_proof(vk, proofs[i], [], key_hash)
        }
    }
}
