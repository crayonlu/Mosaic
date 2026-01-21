use crate::error::AppError;
use crate::models::{ChangePasswordRequest, LoginRequest, User, UserResponse};
use bcrypt::{hash, verify, DEFAULT_COST};
use chrono::Utc;
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
struct Claims {
    sub: String,
    exp: usize,
    iat: usize,
}

#[derive(Clone)]
pub struct AuthService {
    pool: PgPool,
    jwt_secret: String,
}

impl AuthService {
    pub fn new(pool: PgPool, jwt_secret: String) -> Self {
        Self { pool, jwt_secret }
    }

    async fn find_user_by_username(&self, username: &str) -> Result<Option<User>, AppError> {
        let user = sqlx::query_as::<_, User>(
            "SELECT id, username, password_hash, avatar_url, created_at, updated_at
             FROM users WHERE username = $1",
        )
        .bind(username)
        .fetch_optional(&self.pool)
        .await?;

        Ok(user)
    }

    async fn find_user_by_id(&self, user_id: &str) -> Result<Option<User>, AppError> {
        let uuid = Uuid::parse_str(user_id)?;
        let user = sqlx::query_as::<_, User>(
            "SELECT id, username, password_hash, avatar_url, created_at, updated_at
             FROM users WHERE id = $1",
        )
        .bind(uuid)
        .fetch_optional(&self.pool)
        .await?;

        Ok(user)
    }

    pub async fn login(&self, req: LoginRequest) -> Result<crate::models::LoginResponse, AppError> {
        let user = self
            .find_user_by_username(&req.username)
            .await?
            .ok_or(AppError::Unauthorized)?;

        let is_valid = verify(&req.password, &user.password_hash)
            .map_err(|_| AppError::Internal("Password verification failed".to_string()))?;

        if !is_valid {
            return Err(AppError::Unauthorized);
        }

        let access_token = self.generate_token(&user.id.to_string(), 3600 * 24)?; // 24 hours
        let refresh_token = self.generate_token(&user.id.to_string(), 3600 * 24 * 7)?; // 7 days

        Ok(crate::models::LoginResponse {
            access_token,
            refresh_token,
            user: UserResponse::from(user),
        })
    }

    pub async fn change_password(
        &self,
        user_id: &str,
        req: ChangePasswordRequest,
    ) -> Result<(), AppError> {
        let user = self
            .find_user_by_id(user_id)
            .await?
            .ok_or(AppError::UserNotFound)?;

        let is_valid = verify(&req.old_password, &user.password_hash)
            .map_err(|_| AppError::Internal("Password verification failed".to_string()))?;

        if !is_valid {
            return Err(AppError::Unauthorized);
        }

        let new_hash = hash(&req.new_password, DEFAULT_COST)
            .map_err(|_| AppError::Internal("Password hashing failed".to_string()))?;

        let now = Utc::now().timestamp();

        sqlx::query("UPDATE users SET password_hash = $1, updated_at = $2 WHERE id = $3")
            .bind(new_hash)
            .bind(now)
            .bind(user.id)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    pub async fn get_current_user(&self, user_id: &str) -> Result<UserResponse, AppError> {
        let user = self
            .find_user_by_id(user_id)
            .await?
            .ok_or(AppError::UserNotFound)?;

        Ok(UserResponse::from(user))
    }

    pub async fn update_avatar(
        &self,
        user_id: &str,
        avatar_url: String,
    ) -> Result<UserResponse, AppError> {
        let user = self
            .find_user_by_id(user_id)
            .await?
            .ok_or(AppError::UserNotFound)?;

        let now = Utc::now().timestamp();

        let updated_user = sqlx::query_as::<_, User>(
            "UPDATE users SET avatar_url = $1, updated_at = $2 WHERE id = $3
             RETURNING id, username, password_hash, avatar_url, created_at, updated_at",
        )
        .bind(avatar_url)
        .bind(now)
        .bind(user.id)
        .fetch_one(&self.pool)
        .await?;

        Ok(UserResponse::from(updated_user))
    }

    pub fn verify_token(&self, token: &str) -> Result<String, AppError> {
        let token_data = decode::<Claims>(
            token,
            &DecodingKey::from_secret(self.jwt_secret.as_ref()),
            &Validation::default(),
        )?;

        Ok(token_data.claims.sub)
    }

    fn generate_token(&self, user_id: &str, exp_seconds: i64) -> Result<String, AppError> {
        let now = Utc::now().timestamp() as usize;
        let exp = now + exp_seconds as usize;

        let claims = Claims {
            sub: user_id.to_string(),
            exp,
            iat: now,
        };

        encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(self.jwt_secret.as_ref()),
        )
        .map_err(|_| AppError::Internal("Token generation failed".to_string()))
    }
}
