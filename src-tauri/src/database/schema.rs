use serde::{Deserialize, Deserializer, Serialize, Serializer};
use sqlx::{Decode, Encode, Sqlite, Type};
use std::fmt;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MoodKey {
    Joy,
    Anger,
    Sadness,
    Calm,
    Anxiety,
    Focus,
    Tired,
    Neutral,
    // custom mood
    Custom(String),
}

impl Default for MoodKey {
    fn default() -> Self {
        Self::Neutral
    }
}

impl MoodKey {
    pub fn as_str(&self) -> &str {
        match self {
            MoodKey::Joy => "joy",
            MoodKey::Anger => "anger",
            MoodKey::Sadness => "sadness",
            MoodKey::Calm => "calm",
            MoodKey::Anxiety => "anxiety",
            MoodKey::Focus => "focus",
            MoodKey::Tired => "tired",
            MoodKey::Neutral => "neutral",
            MoodKey::Custom(s) => s.as_str(),
        }
    }
}

impl fmt::Display for MoodKey {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

impl<T: AsRef<str>> From<T> for MoodKey {
    fn from(s: T) -> Self {
        match s.as_ref().to_lowercase().as_str() {
            "joy" => MoodKey::Joy,
            "anger" => MoodKey::Anger,
            "sadness" => MoodKey::Sadness,
            "calm" => MoodKey::Calm,
            "anxiety" => MoodKey::Anxiety,
            "focus" => MoodKey::Focus,
            "tired" => MoodKey::Tired,
            "neutral" => MoodKey::Neutral,
            other => MoodKey::Custom(other.to_string()),
        }
    }
}

impl Serialize for MoodKey {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(self.as_str())
    }
}

impl<'de> Deserialize<'de> for MoodKey {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        Ok(MoodKey::from(s)) // 调用 From<String>
    }
}

impl Type<Sqlite> for MoodKey {
    fn type_info() -> sqlx::sqlite::SqliteTypeInfo {
        <String as Type<Sqlite>>::type_info()
    }
}

impl<'q> Encode<'q, Sqlite> for MoodKey {
    fn encode_by_ref(
        &self,
        buf: &mut Vec<sqlx::sqlite::SqliteArgumentValue<'q>>,
    ) -> Result<sqlx::encode::IsNull, Box<dyn std::error::Error + Send + Sync>> {
        let s = self.as_str().to_string();
        <String as Encode<'q, Sqlite>>::encode_by_ref(&s, buf)
    }
}

impl<'r> Decode<'r, Sqlite> for MoodKey {
    fn decode(value: sqlx::sqlite::SqliteValueRef<'r>) -> Result<Self, sqlx::error::BoxDynError> {
        let s = <String as Decode<'r, Sqlite>>::decode(value)?;
        Ok(MoodKey::from(s))
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[sqlx(type_name = "TEXT", rename_all = "lowercase")]
#[serde(rename_all = "camelCase")]
pub enum ResourceType {
    Image,
    Voice,
    Video,
    File,
}

impl Default for ResourceType {
    fn default() -> Self {
        Self::File
    }
}
