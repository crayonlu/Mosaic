use crate::error::AppError;
use crate::middleware::auth::Claims;
use crate::models::{
    ChangePasswordRequest, CreateUserRequest, LoginRequest, ManagedUserResponse,
    RefreshTokenResponse, UpdateManagedUserRequest, User, UserResponse,
};
use bcrypt::{hash, verify, DEFAULT_COST};
use chrono::Utc;
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Clone)]
pub struct AuthService {
    pool: PgPool,
    jwt_secret: String,
}

impl AuthService {
    pub fn new(pool: PgPool, jwt_secret: String) -> Self {
        Self { pool, jwt_secret }
    }

    pub async fn ensure_admin_user(&self, username: &str, password: &str) -> Result<(), AppError> {
        let exists: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users WHERE username = $1")
            .bind(username)
            .fetch_one(&self.pool)
            .await?;

        if exists == 0 {
            let now = chrono::Utc::now().timestamp();
            let password_hash = bcrypt::hash(password, bcrypt::DEFAULT_COST)
                .map_err(|_| AppError::Internal("Password hashing failed".to_string()))?;

            sqlx::query(
                "INSERT INTO users (username, password_hash, role, must_change_password, is_active, created_at, updated_at)
                 VALUES ($1, $2, 'admin', false, true, $3, $4)",
            )
            .bind(username)
            .bind(password_hash)
            .bind(now)
            .bind(now)
            .execute(&self.pool)
            .await?;
        } else {
            // Ensure existing admin user has admin role
            sqlx::query("UPDATE users SET role = 'admin' WHERE username = $1 AND role != 'admin'")
                .bind(username)
                .execute(&self.pool)
                .await?;
        }

        Ok(())
    }

    async fn find_user_by_username(&self, username: &str) -> Result<Option<User>, AppError> {
        let user = sqlx::query_as::<_, User>(
            "SELECT id, username, password_hash, avatar_url, role, must_change_password, is_active, created_at, updated_at
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
            "SELECT id, username, password_hash, avatar_url, role, must_change_password, is_active, created_at, updated_at
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

        if !user.is_active {
            return Err(AppError::Forbidden("Account is disabled".to_string()));
        }

        let is_valid = verify(&req.password, &user.password_hash)
            .map_err(|_| AppError::Internal("Password verification failed".to_string()))?;

        if !is_valid {
            return Err(AppError::Unauthorized);
        }

        let access_token = self.generate_token(
            &user.id.to_string(),
            &user.role,
            user.must_change_password,
            3600 * 24 * 7,
        )?; // 7 days
        let refresh_token = self.generate_token(
            &user.id.to_string(),
            &user.role,
            user.must_change_password,
            3600 * 24 * 30,
        )?; // 30 days;

        let must_change_password = user.must_change_password;

        Ok(crate::models::LoginResponse {
            access_token,
            refresh_token,
            user: UserResponse::from(user),
            must_change_password,
        })
    }

    pub async fn change_password(
        &self,
        user_id: &str,
        req: ChangePasswordRequest,
    ) -> Result<RefreshTokenResponse, AppError> {
        let user = self
            .find_user_by_id(user_id)
            .await?
            .ok_or(AppError::UserNotFound)?;

        let is_valid = verify(&req.old_password, &user.password_hash)
            .map_err(|_| AppError::Internal("Password verification failed".to_string()))?;

        if !is_valid {
            return Err(AppError::Unauthorized);
        }

        if req.new_password.len() < 8 {
            return Err(AppError::InvalidInput(
                "Password must be at least 8 characters".to_string(),
            ));
        }

        let new_hash = hash(&req.new_password, DEFAULT_COST)
            .map_err(|_| AppError::Internal("Password hashing failed".to_string()))?;

        let now = Utc::now().timestamp();

        sqlx::query(
            "UPDATE users SET password_hash = $1, must_change_password = false, updated_at = $2 WHERE id = $3",
        )
        .bind(new_hash)
        .bind(now)
        .bind(user.id)
        .execute(&self.pool)
        .await?;

        // Return fresh tokens with mcp=false so clients don't need a separate refresh call
        let new_access_token =
            self.generate_token(&user.id.to_string(), &user.role, false, 3600 * 24 * 7)?;
        let new_refresh_token =
            self.generate_token(&user.id.to_string(), &user.role, false, 3600 * 24 * 30)?;

        Ok(RefreshTokenResponse {
            access_token: new_access_token,
            refresh_token: new_refresh_token,
        })
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
             RETURNING id, username, password_hash, avatar_url, role, must_change_password, is_active, created_at, updated_at",
        )
        .bind(avatar_url)
        .bind(now)
        .bind(user.id)
        .fetch_one(&self.pool)
        .await?;

        Ok(UserResponse::from(updated_user))
    }

    pub async fn update_user(
        &self,
        user_id: &str,
        username: Option<String>,
        avatar_url: Option<String>,
    ) -> Result<UserResponse, AppError> {
        let user = self
            .find_user_by_id(user_id)
            .await?
            .ok_or(AppError::UserNotFound)?;

        let now = Utc::now().timestamp();

        if username.is_none() && avatar_url.is_none() {
            return Ok(UserResponse::from(user));
        }

        match (username, avatar_url) {
            (Some(username), Some(avatar_url)) => {
                let updated_user = sqlx::query_as::<_, User>(
                    "UPDATE users SET username = $1, avatar_url = $2, updated_at = $3 WHERE id = $4
                     RETURNING id, username, password_hash, avatar_url, role, must_change_password, is_active, created_at, updated_at",
                )
                .bind(username)
                .bind(avatar_url)
                .bind(now)
                .bind(user.id)
                .fetch_one(&self.pool)
                .await?;
                Ok(UserResponse::from(updated_user))
            }
            (Some(username), None) => {
                let updated_user = sqlx::query_as::<_, User>(
                    "UPDATE users SET username = $1, updated_at = $2 WHERE id = $3
                     RETURNING id, username, password_hash, avatar_url, role, must_change_password, is_active, created_at, updated_at",
                )
                .bind(username)
                .bind(now)
                .bind(user.id)
                .fetch_one(&self.pool)
                .await?;
                Ok(UserResponse::from(updated_user))
            }
            (None, Some(avatar_url)) => {
                let updated_user = sqlx::query_as::<_, User>(
                    "UPDATE users SET avatar_url = $1, updated_at = $2 WHERE id = $3
                     RETURNING id, username, password_hash, avatar_url, role, must_change_password, is_active, created_at, updated_at",
                )
                .bind(avatar_url)
                .bind(now)
                .bind(user.id)
                .fetch_one(&self.pool)
                .await?;
                Ok(UserResponse::from(updated_user))
            }
            (None, None) => unreachable!(),
        }
    }

    pub async fn refresh_token(
        &self,
        refresh_token: String,
    ) -> Result<RefreshTokenResponse, AppError> {
        let claims = decode::<Claims>(
            &refresh_token,
            &DecodingKey::from_secret(self.jwt_secret.as_ref()),
            &Validation::default(),
        )
        .map_err(|_| AppError::InvalidToken)?;

        let user_id = claims.claims.sub;

        let user = self
            .find_user_by_id(&user_id)
            .await?
            .ok_or(AppError::UserNotFound)?;

        if !user.is_active {
            return Err(AppError::Forbidden("Account is disabled".to_string()));
        }

        let new_access_token = self.generate_token(
            &user_id,
            &user.role,
            user.must_change_password,
            3600 * 24 * 7,
        )?; // 7 days
        let new_refresh_token = self.generate_token(
            &user_id,
            &user.role,
            user.must_change_password,
            3600 * 24 * 30,
        )?; // 30 days;

        Ok(RefreshTokenResponse {
            access_token: new_access_token,
            refresh_token: new_refresh_token,
        })
    }

    // --- Admin user management ---

    pub async fn create_user(
        &self,
        req: CreateUserRequest,
    ) -> Result<ManagedUserResponse, AppError> {
        if req.username.trim().is_empty() {
            return Err(AppError::InvalidInput(
                "Username cannot be empty".to_string(),
            ));
        }
        if req.password.len() < 8 {
            return Err(AppError::InvalidInput(
                "Password must be at least 8 characters".to_string(),
            ));
        }

        let exists: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users WHERE username = $1")
            .bind(&req.username)
            .fetch_one(&self.pool)
            .await?;

        if exists > 0 {
            return Err(AppError::InvalidInput(
                "Username already exists".to_string(),
            ));
        }

        let now = chrono::Utc::now().timestamp();
        let password_hash = bcrypt::hash(&req.password, bcrypt::DEFAULT_COST)
            .map_err(|_| AppError::Internal("Password hashing failed".to_string()))?;

        let user = sqlx::query_as::<_, User>(
            "INSERT INTO users (username, password_hash, role, must_change_password, is_active, created_at, updated_at)
             VALUES ($1, $2, 'user', true, true, $3, $4)
             RETURNING id, username, password_hash, avatar_url, role, must_change_password, is_active, created_at, updated_at",
        )
        .bind(&req.username)
        .bind(password_hash)
        .bind(now)
        .bind(now)
        .fetch_one(&self.pool)
        .await?;

        Ok(ManagedUserResponse::from(user))
    }

    pub async fn list_users(
        &self,
        page: i64,
        page_size: i64,
    ) -> Result<(Vec<ManagedUserResponse>, i64), AppError> {
        let page = page.max(1);
        let page_size = page_size.clamp(1, 100);
        let offset = (page - 1) * page_size;

        let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users")
            .fetch_one(&self.pool)
            .await?;

        let users = sqlx::query_as::<_, User>(
            "SELECT id, username, password_hash, avatar_url, role, must_change_password, is_active, created_at, updated_at
             FROM users ORDER BY created_at ASC LIMIT $1 OFFSET $2",
        )
        .bind(page_size)
        .bind(offset)
        .fetch_all(&self.pool)
        .await?;

        Ok((
            users.into_iter().map(ManagedUserResponse::from).collect(),
            total,
        ))
    }

    pub async fn update_managed_user(
        &self,
        target_user_id: &str,
        admin_user_id: &str,
        req: UpdateManagedUserRequest,
    ) -> Result<ManagedUserResponse, AppError> {
        let target_uuid = Uuid::parse_str(target_user_id)?;
        let admin_uuid = Uuid::parse_str(admin_user_id)?;

        // Prevent admin from disabling or demoting themselves
        if target_uuid == admin_uuid {
            if let Some(false) = req.is_active {
                return Err(AppError::InvalidInput(
                    "Cannot disable your own account".to_string(),
                ));
            }
            if let Some(ref role) = req.role {
                if role != "admin" {
                    return Err(AppError::InvalidInput(
                        "Cannot demote your own account".to_string(),
                    ));
                }
            }
        }

        let user = self
            .find_user_by_id(target_user_id)
            .await?
            .ok_or(AppError::UserNotFound)?;

        let now = Utc::now().timestamp();
        let new_is_active = req.is_active.unwrap_or(user.is_active);
        let new_role = req.role.as_deref().unwrap_or(&user.role).to_string();

        if new_role != "admin" && new_role != "user" {
            return Err(AppError::InvalidInput(
                "Role must be 'admin' or 'user'".to_string(),
            ));
        }

        let new_password_hash = if let Some(ref new_pass) = req.reset_password {
            if new_pass.len() < 8 {
                return Err(AppError::InvalidInput(
                    "Password must be at least 8 characters".to_string(),
                ));
            }
            Some(
                bcrypt::hash(new_pass, bcrypt::DEFAULT_COST)
                    .map_err(|_| AppError::Internal("Password hashing failed".to_string()))?,
            )
        } else {
            None
        };

        let must_change = if req.reset_password.is_some() {
            true
        } else {
            user.must_change_password
        };

        let updated = sqlx::query_as::<_, User>(
            "UPDATE users SET is_active = $1, role = $2, must_change_password = $3, password_hash = COALESCE($4, password_hash), updated_at = $5
             WHERE id = $6
             RETURNING id, username, password_hash, avatar_url, role, must_change_password, is_active, created_at, updated_at",
        )
        .bind(new_is_active)
        .bind(&new_role)
        .bind(must_change)
        .bind(new_password_hash)
        .bind(now)
        .bind(target_uuid)
        .fetch_one(&self.pool)
        .await?;

        Ok(ManagedUserResponse::from(updated))
    }

    fn generate_token(
        &self,
        user_id: &str,
        role: &str,
        mcp: bool,
        exp_seconds: i64,
    ) -> Result<String, AppError> {
        let now = Utc::now().timestamp() as usize;
        let exp = now + exp_seconds as usize;

        let claims = Claims {
            sub: user_id.to_string(),
            role: role.to_string(),
            mcp,
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
