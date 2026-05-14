use arcis::*;

#[encrypted]
mod circuits {
    use arcis::*;

    pub struct KeyShardInput {
        shard: u8,
        authorized: u8,
    }

    #[instruction]
    pub fn release_key_shard(input_ctxt: Enc<Shared, KeyShardInput>) -> Enc<Shared, u8> {
        let input = input_ctxt.to_arcis();
        let released = if input.authorized == 1 { input.shard } else { 0 };
        input_ctxt.owner.from_arcis(released)
    }
}
