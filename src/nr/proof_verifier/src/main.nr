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

    global PROOFS_LEN: u32 = 2;

    #[public]
    fn aggregate_proofs(
        vks: [bb::UltraHonkVerificationKey; PROOFS_LEN],
        proofs: [bb::UltraHonkProof; PROOFS_LEN],
        key_hashes: [Field; PROOFS_LEN],
    ) {
        for i in 0..PROOFS_LEN {
            bb::verify_ultrahonk_proof(vks[i], proofs[i], [], key_hashes[i])
        }
    }
}
