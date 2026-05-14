/**
 * CipherGate — Anchor Smart Contract
 * ─────────────────────────────────────
 * Solana program managing asset listings and access records.
 * Deployed on Devnet.
 *
 * Instructions:
 *   create_asset      — Creator lists an encrypted file
 *   purchase_access   — Buyer pays SOL, access record is created
 *   increment_usage   — Track decryption count on-chain
 *   revoke_access     — Creator revokes a user's access record
 *
 * Account PDAs:
 *   Asset:        seeds = ["asset", owner.key, id]
 *   AccessRecord: seeds = ["access", asset.key, user.key]
 */

use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("CGatE1111111111111111111111111111111111111111");

// Max lengths for on-chain strings
const MAX_TITLE_LEN: usize = 64;
const MAX_CID_LEN: usize = 64;       // IPFS CIDv1 base32 is ~59 chars
const MAX_POLICY_ID_LEN: usize = 32;

#[program]
pub mod ciphergate {
    use super::*;

    /// Create a new encrypted asset listing
    ///
    /// The creator specifies:
    ///   - IPFS CID of the encrypted file
    ///   - Arcium policy ID (links to MPC key storage)
    ///   - Price in lamports
    ///   - Access policy (expiry, max decryptions)
    pub fn create_asset(
        ctx: Context<CreateAsset>,
        id: String,
        title: String,
        cid: String,
        policy_id: String,
        price: u64,
        expiry_hours: i64,      // 0 = no expiry
        max_decryptions: u8,    // 0 = unlimited
    ) -> Result<()> {
        require!(title.len() <= MAX_TITLE_LEN, CipherGateError::TitleTooLong);
        require!(cid.len() <= MAX_CID_LEN, CipherGateError::CidTooLong);
        require!(policy_id.len() <= MAX_POLICY_ID_LEN, CipherGateError::PolicyIdTooLong);
        require!(price > 0, CipherGateError::PriceMustBePositive);

        let asset = &mut ctx.accounts.asset;
        asset.id = id;
        asset.title = title;
        asset.owner = ctx.accounts.owner.key();
        asset.cid = cid;
        asset.policy_id = policy_id;
        asset.price = price;
        asset.expiry_hours = expiry_hours;
        asset.max_decryptions = max_decryptions;
        asset.created_at = Clock::get()?.unix_timestamp;
        asset.active = true;

        emit!(AssetCreated {
            id: asset.id.clone(),
            owner: asset.owner,
            price: asset.price,
        });

        Ok(())
    }

    /// Purchase access to an asset
    ///
    /// Transfers SOL from buyer to creator.
    /// Creates an AccessRecord PDA for the buyer.
    /// The actual key authorization happens in Arcium MPC off-chain,
    /// but this on-chain record serves as proof-of-payment.
    pub fn purchase_access(ctx: Context<PurchaseAccess>) -> Result<()> {
        let asset = &ctx.accounts.asset;
        let buyer = &ctx.accounts.buyer;
        let owner = &ctx.accounts.owner;

        require!(asset.active, CipherGateError::AssetNotActive);
        require!(buyer.key() != owner.key(), CipherGateError::CannotBuyOwnAsset);

        // Transfer SOL: buyer → asset owner
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: buyer.to_account_info(),
                to: owner.to_account_info(),
            },
        );
        system_program::transfer(cpi_context, asset.price)?;

        // Initialise access record
        let record = &mut ctx.accounts.access_record;
        record.user = buyer.key();
        record.asset = asset.key();
        record.uses = 0;
        record.purchased_at = Clock::get()?.unix_timestamp;

        // Set expiry timestamp
        if asset.expiry_hours > 0 {
            record.expiry = record.purchased_at + (asset.expiry_hours * 3600);
        } else {
            record.expiry = i64::MAX; // No expiry
        }

        emit!(AccessPurchased {
            asset: asset.key(),
            user: buyer.key(),
            expiry: record.expiry,
        });

        Ok(())
    }

    /// Increment the usage counter for an access record
    ///
    /// Called after a successful decryption.
    /// Arcium MPC also tracks this internally.
    pub fn increment_usage(ctx: Context<IncrementUsage>) -> Result<()> {
        let asset = &ctx.accounts.asset;
        let record = &mut ctx.accounts.access_record;
        let now = Clock::get()?.unix_timestamp;

        // Validate access is still valid
        require!(record.expiry == i64::MAX || now < record.expiry, CipherGateError::AccessExpired);

        if asset.max_decryptions > 0 {
            require!(record.uses < asset.max_decryptions, CipherGateError::UsageLimitReached);
        }

        record.uses = record.uses.checked_add(1).ok_or(CipherGateError::Overflow)?;

        Ok(())
    }

    /// Revoke access for a specific user
    ///
    /// Only the asset owner can revoke.
    /// Sets expiry to the past — future decrypt attempts in Arcium will fail.
    pub fn revoke_access(ctx: Context<RevokeAccess>) -> Result<()> {
        let record = &mut ctx.accounts.access_record;

        // Set expiry to the past to invalidate
        record.expiry = 0;

        emit!(AccessRevoked {
            asset: ctx.accounts.asset.key(),
            user: ctx.accounts.target_user.key(),
        });

        Ok(())
    }
}

// ─── Accounts ─────────────────────────────────────────────────────────────

#[account]
pub struct Asset {
    pub id: String,               // 4 + 32
    pub title: String,            // 4 + 64
    pub owner: Pubkey,            // 32
    pub cid: String,              // 4 + 64 (IPFS CID)
    pub policy_id: String,        // 4 + 32 (Arcium policy ref)
    pub price: u64,               // 8
    pub expiry_hours: i64,        // 8
    pub max_decryptions: u8,      // 1
    pub created_at: i64,          // 8
    pub active: bool,             // 1
}

#[account]
pub struct AccessRecord {
    pub user: Pubkey,             // 32
    pub asset: Pubkey,            // 32
    pub uses: u8,                 // 1
    pub expiry: i64,              // 8
    pub purchased_at: i64,        // 8
}

// ─── Instruction Contexts ─────────────────────────────────────────────────

#[derive(Accounts)]
#[instruction(id: String)]
pub struct CreateAsset<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + 4 + 32 + 4 + 64 + 32 + 4 + 64 + 4 + 32 + 8 + 8 + 1 + 8 + 1,
        seeds = [b"asset", owner.key().as_ref(), id.as_bytes()],
        bump
    )]
    pub asset: Account<'info, Asset>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PurchaseAccess<'info> {
    pub asset: Account<'info, Asset>,

    #[account(
        init,
        payer = buyer,
        space = 8 + 32 + 32 + 1 + 8 + 8,
        seeds = [b"access", asset.key().as_ref(), buyer.key().as_ref()],
        bump
    )]
    pub access_record: Account<'info, AccessRecord>,

    #[account(mut)]
    pub buyer: Signer<'info>,

    /// CHECK: We verify this is the asset owner via the asset account
    #[account(
        mut,
        constraint = owner.key() == asset.owner @ CipherGateError::InvalidOwner
    )]
    pub owner: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct IncrementUsage<'info> {
    pub asset: Account<'info, Asset>,

    #[account(
        mut,
        seeds = [b"access", asset.key().as_ref(), user.key().as_ref()],
        bump,
        constraint = access_record.user == user.key() @ CipherGateError::Unauthorized
    )]
    pub access_record: Account<'info, AccessRecord>,

    pub user: Signer<'info>,
}

#[derive(Accounts)]
pub struct RevokeAccess<'info> {
    pub asset: Account<'info, Asset>,

    #[account(
        mut,
        seeds = [b"access", asset.key().as_ref(), target_user.key().as_ref()],
        bump,
    )]
    pub access_record: Account<'info, AccessRecord>,

    /// CHECK: Target user whose access is being revoked
    pub target_user: AccountInfo<'info>,

    #[account(
        constraint = owner.key() == asset.owner @ CipherGateError::Unauthorized
    )]
    pub owner: Signer<'info>,
}

// ─── Events ───────────────────────────────────────────────────────────────

#[event]
pub struct AssetCreated {
    pub id: String,
    pub owner: Pubkey,
    pub price: u64,
}

#[event]
pub struct AccessPurchased {
    pub asset: Pubkey,
    pub user: Pubkey,
    pub expiry: i64,
}

#[event]
pub struct AccessRevoked {
    pub asset: Pubkey,
    pub user: Pubkey,
}

// ─── Errors ───────────────────────────────────────────────────────────────

#[error_code]
pub enum CipherGateError {
    #[msg("Title exceeds maximum length")]
    TitleTooLong,
    #[msg("CID exceeds maximum length")]
    CidTooLong,
    #[msg("Policy ID exceeds maximum length")]
    PolicyIdTooLong,
    #[msg("Price must be greater than zero")]
    PriceMustBePositive,
    #[msg("Asset is not active")]
    AssetNotActive,
    #[msg("Cannot purchase your own asset")]
    CannotBuyOwnAsset,
    #[msg("Access has expired")]
    AccessExpired,
    #[msg("Usage limit has been reached")]
    UsageLimitReached,
    #[msg("Invalid asset owner")]
    InvalidOwner,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Arithmetic overflow")]
    Overflow,
}
