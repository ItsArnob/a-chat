use anyhow::Context;
use dashmap::DashMap;
use futures_util::{future::FutureExt, TryStreamExt};
use mongodb::{
    bson::{doc, Document},
    options::{Collation, CollationStrength, FindOneOptions, FindOptions},
};
use serde::{Deserialize, Serialize};

use ulid::Ulid;

use super::chat::{Chat, ChatRecipient};
use crate::{
    app::UserSocket,
    database::{models::chat::ChatType, Database},
    routes::users::{AddFriendResponse, AddFriendUser, RemoveFriendResponse, RemoveFriendUser},
    util::result::{ApiError, ApiResult},
};

/// User is the user model with the profile field
#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct User {
    #[serde(flatten)]
    pub account: UserAccount,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub profile: Option<UserProfile>,
}
/// UserAccount is the user model without the profile field
#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UserAccount {
    #[serde(rename = "_id")]
    pub id: String,
    pub username: String,
    pub password_hash: String,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct UserProfile {
    pub relations: Vec<Relation>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct Relation {
    pub id: String,
    pub status: RelationStatus,
}

/// NEVER EVER SET A RELATIONSTATU AS NONE IN MONGODB. IT WILL CAUSE DUPLICATIONS.
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub enum RelationStatus {
    None,
    Friend,
    Blocked,
    BlockedByOther,
    Incoming,
    Outgoing,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct UserUsername {
    #[serde(rename = "_id")]
    pub id: String,
    pub username: String,
}

#[derive(Debug, Serialize)]
pub struct RelatedUserStatus {
    pub id: String,
    pub username: String,
    pub online: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_seen_s: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub relationship: Option<RelationStatus>,
}

impl ToString for RelationStatus {
    // TODO: figure out how to use serde here.
    fn to_string(&self) -> String {
        match self {
            RelationStatus::None => "None".to_string(),
            RelationStatus::Friend => "Friend".to_string(),
            RelationStatus::Blocked => "Blocked".to_string(),
            RelationStatus::BlockedByOther => "BlockedByOther".to_string(),
            RelationStatus::Incoming => "Incoming".to_string(),
            RelationStatus::Outgoing => "Outgoing".to_string(),
        }
    }
}
pub async fn find_related_users_with_status(
    db: &Database,
    user_ids: &[&str],
    relations: &[Relation],
    sockets: &DashMap<String, UserSocket>,
) -> ApiResult<Vec<RelatedUserStatus>> {
    let mut users_cursor = db
        .users::<UserUsername>()
        .find(
            doc! {
                "_id": {
                    "$in": user_ids
                }
            },
            FindOptions::builder()
                .projection(doc! { "_id": 1, "username": 1})
                .build(),
        )
        .await
        .context("find_related_users_with_status: Failed to find users")?;

    let mut users: Vec<RelatedUserStatus> = vec![];
    while let Some(user) = users_cursor
        .try_next()
        .await
        .context("find_related_users_with_status: Failed to get next user from cursor")?
    {
        let relationship = relations.iter().find(|relation| relation.id == user.id);

        let (online, last_seen_s) = {
            if let Some(socket) = sockets.get(&user.id) {
                (socket.online, socket.last_seen_s)
            } else {
                (false, None)
            }
        };

        users.push(RelatedUserStatus {
            id: user.id,
            username: user.username,
            online,
            last_seen_s,
            relationship: relationship.map(|r| r.status.to_owned()),
        });
    }
    Ok(users)
}
async fn user_exists_by_username(db: &Database, username: &str) -> ApiResult<bool> {
    // find user using en_us collation
    let user = db
        .users::<Document>()
        .find_one(
            doc! { "username": username },
            FindOneOptions::builder()
                .collation(
                    Collation::builder()
                        .strength(CollationStrength::Secondary)
                        .locale("en")
                        .build(),
                )
                .projection(doc! { "_id": 1 })
                .build(),
        )
        .await
        .context("user_exists_by_username: Failed to find user by username")?;
    match user {
        Some(_) => Ok(true),
        None => Ok(false),
    }
}
// TODO: seems like overoptimization. refactor code to just use find_user_by_id?
/// returns the user without the profile field
pub async fn find_account_by_id(db: &Database, id: &str) -> ApiResult<Option<UserAccount>> {
    let account = db
        .users::<UserAccount>()
        .find_one(
            doc! { "_id": id },
            FindOneOptions::builder()
                .projection(doc! { "profile": 0 })
                .build(),
        )
        .await
        .context("find_account_by_id: Failed to find user by id")?;

    Ok(account)
}

pub async fn find_user_by_id(db: &Database, id: &str) -> ApiResult<Option<User>> {
    let user = db
        .users::<User>()
        .find_one(doc! { "_id": id }, None)
        .await
        .context("find_user_by_id: Failed to find user by id")?;

    Ok(user)
}

async fn find_user_by_name(db: &Database, username: &str) -> ApiResult<Option<User>> {
    let user = db
        .users::<User>()
        .find_one(
            doc! { "username": username },
            FindOneOptions::builder()
                .collation(
                    Collation::builder()
                        .strength(CollationStrength::Secondary)
                        .locale("en")
                        .build(),
                )
                .build(),
        )
        .await
        .context("find_user_by_name: Failed to find user by username")?;

    Ok(user)
}

async fn find_account_by_name(db: &Database, username: &str) -> ApiResult<Option<UserAccount>> {
    let account = db
        .users::<UserAccount>()
        .find_one(
            doc! { "username": username },
            FindOneOptions::builder()
                .collation(
                    Collation::builder()
                        .strength(CollationStrength::Secondary)
                        .locale("en")
                        .build(),
                )
                .projection(doc! { "profile": 0 })
                .build(),
        )
        .await
        .context("find_account_by_name: Failed to find user by username")?;

    Ok(account)
}
pub async fn get_friend_ids(db: &Database, user_id: &str) -> ApiResult<Vec<String>> {
    let user = db
        .users::<User>()
        .find_one(
            doc! {
                "_id": user_id
            },
            None,
        )
        .await
        .context("get_friend_ids: Failed to find user")?;

    let user = match user {
        Some(user) => user,
        None => return Err(ApiError::UserNotFound),
    };

    match user.profile {
        Some(profile) => Ok(profile
            .relations
            .into_iter()
            .filter(|relation| relation.status == RelationStatus::Friend)
            .map(|relation| relation.id)
            .collect()),
        None => Ok(vec![]),
    }
}
pub async fn find_relations_of_user(db: &Database, user_id: &str) -> ApiResult<Vec<Relation>> {
    let user = db
        .users::<User>()
        .find_one(
            doc! {
                "_id": user_id
            },
            None,
        )
        .await
        .context("find_relations_of_user: Failed to find user")?;

    let user = match user {
        Some(user) => user,
        None => return Err(ApiError::UserNotFound),
    };

    match user.profile {
        Some(profile) => Ok(profile.relations),
        None => Ok(vec![]),
    }
}
pub async fn create_user(db: &Database, username: &str, password: &str) -> ApiResult<String> {
    // TODO: check DISABLE_SIGNUPS env var
    // TODO: use emails + prevent user enumeration.
    let user_exists = user_exists_by_username(db, username).await?;

    if user_exists {
        // warn!(
        //     event = format!("user_create_fail:{username},user_exists"),
        //     description = "User account creation attempted with an existing username."
        // );
        return Err(ApiError::DuplicateUser(None));
    }

    let password_hash = bcrypt::hash(password, bcrypt::DEFAULT_COST)
        .context("create_user: bcrypt hashing failed")?;
    let user = User {
        account: UserAccount {
            id: Ulid::new().to_string(),
            username: username.to_string(),
            password_hash,
        },
        profile: None,
    };

    db.users::<User>()
        .insert_one(&user, None)
        .await
        .context("create_user: Failed to insert user into database")?;
    Ok(user.account.id)
}

pub async fn validate_user(
    db: &Database,
    username: &str,
    password: &str,
) -> ApiResult<UserAccount> {
    let user = find_account_by_name(db, username).await?;

    let user = match user {
        Some(user) => user,
        None => return Err(ApiError::InvalidCredentials),
    };

    let is_valid = bcrypt::verify(password, &user.password_hash)
        .context("validate_user: bcrypt verification failed")?;

    if !is_valid {
        return Err(ApiError::InvalidCredentials);
    }

    Ok(user)
}

pub async fn add_friend(
    db: &Database,
    receiver_username_or_id: &str,
    sender_id: &str,
    is_id: bool,
) -> ApiResult<AddFriendResponse> {
    // TODO: test if this returns USERNOTFOUND on mongodb errors.
    let receiver_user = if is_id {
        find_user_by_id(db, receiver_username_or_id).await?
    } else {
        find_user_by_name(db, receiver_username_or_id).await?
    }
    .ok_or(ApiError::UserNotFound)?;

    if receiver_user.account.id == *sender_id {
        return Err(ApiError::CantAddSelf);
    }

    let relationship = match receiver_user.profile {
        Some(profile) => {
            if let Some(relation) = profile
                .relations
                .into_iter()
                .find(|relation| relation.id == *sender_id)
            {
                relation.status
            } else {
                RelationStatus::None
            }
        }
        None => RelationStatus::None,
    };

    match relationship {
        RelationStatus::Friend => Err(ApiError::AlreadyFriends),
        RelationStatus::Blocked => Err(ApiError::BlockedByOtherFriend),
        RelationStatus::BlockedByOther => Err(ApiError::BlockedFriend),
        RelationStatus::Incoming => Err(ApiError::AlreadySentFR),
        RelationStatus::Outgoing => {
            // accepts friend request
            let mut session = db
                .client
                .start_session(None)
                .await
                .context("add_friend: Failed to start mongodb session")?;
            let chat = session
                .with_transaction(
                    (
                        &db.users::<User>(),
                        &db.chats::<Chat>(),
                        sender_id,
                        receiver_user.account.id.as_str(),
                    ),
                    |session, (users, chats, sender_id, receiver_id)| {
                        async move {
                            users.update_one_with_session(doc! {
                            "_id": *receiver_id,
                            "profile.relations.id": *sender_id,
                        }, doc! {
                            "$set": {
                            "profile.relations.$.status": RelationStatus::Friend.to_string()
                            }
                        }, None, session).await?;

                            users.update_one_with_session(doc! {
                            "_id": *sender_id,
                            "profile.relations.id": *receiver_id,
                        }, doc! {
                            "$set": {
                            "profile.relations.$.status": RelationStatus::Friend.to_string()
                            }
                        }, None, session).await?;

                            let chat = chats
                                .find_one_with_session(
                                    doc! {
                                        "chatType": ChatType::Direct.to_string(),
                                        "recipients.id": {
                                            "$all": [*sender_id, *receiver_id]
                                        }
                                    },
                                    None,
                                    session,
                                )
                                .await?;

                            match chat {
                                Some(chat) => Ok(chat),
                                None => {
                                    let chat = Chat {
                                        id: Ulid::new().to_string(),
                                        chat_type: ChatType::Direct,
                                        recipients: vec![
                                            ChatRecipient {
                                                id: receiver_id.to_string(),
                                            },
                                            ChatRecipient {
                                                id: sender_id.to_string(),
                                            },
                                        ],
                                        last_message_id: None,
                                    };

                                    chats.insert_one_with_session(&chat, None, session).await?;
                                    Ok(chat)
                                }
                            }
                        }
                        .boxed()
                    },
                    None,
                )
                .await
                .context("add_friend: Failed to accept friend request: transaction failed")?;
            Ok(AddFriendResponse {
                user: AddFriendUser {
                    id: receiver_user.account.id,
                    username: receiver_user.account.username,
                },
                chat: Some(chat.into()),
                message: "Friend request accepted".to_string(),
            })
        }
        RelationStatus::None => {
            // sends friend request
            let mut session = db
                .client
                .start_session(None)
                .await
                .context("add_friend: Failed to start mongodb session")?;
            session
                .with_transaction(
                    (
                        &db.users::<User>(),
                        sender_id,
                        receiver_user.account.id.as_str(),
                    ),
                    |session, (users, sender_id, receiver_id)| {
                        async move {
                            users
                                .update_one_with_session(
                                    doc! {
                                        "_id": *receiver_id,
                                    },
                                    doc! {
                                        "$push": {
                                            "profile.relations": {
                                                "id": *sender_id,
                                                "status":  RelationStatus::Incoming.to_string()
                                            }
                                        }
                                    },
                                    None,
                                    session,
                                )
                                .await?;

                            users
                                .update_one_with_session(
                                    doc! {
                                        "_id": *sender_id,
                                    },
                                    doc! {
                                        "$push": {
                                            "profile.relations": {
                                                "id": *receiver_id,
                                                "status": RelationStatus::Outgoing.to_string()
                                            }
                                        }
                                    },
                                    None,
                                    session,
                                )
                                .await?;

                            Ok(())
                        }
                        .boxed()
                    },
                    None,
                )
                .await
                .context("add_friend: Failed to send friend request: transaction failed")?;
            Ok(AddFriendResponse {
                user: AddFriendUser {
                    id: receiver_user.account.id,
                    username: receiver_user.account.username,
                },
                chat: None,
                message: "Friend request sent".to_string(),
            })
        }
    }
}

pub async fn remove_friend(
    db: &Database,
    receiver_id: &str,
    sender_id: &str,
) -> ApiResult<RemoveFriendResponse> {
    if receiver_id == sender_id {
        return Err(ApiError::CantRemoveSelf);
    }
    let receiver_user = find_user_by_id(db, receiver_id).await?;
    let receiver_user = match receiver_user {
        Some(user) => user,
        None => return Err(ApiError::UserNotFound),
    };

    let relationship = match receiver_user.profile {
        Some(profile) => {
            if let Some(relation) = profile
                .relations
                .into_iter()
                .find(|relation| relation.id == *sender_id)
            {
                relation.status
            } else {
                RelationStatus::None
            }
        }
        None => RelationStatus::None,
    };

    match relationship {
        RelationStatus::Blocked => Err(ApiError::BlockedByOtherFriend),
        RelationStatus::BlockedByOther => Err(ApiError::BlockedFriend),

        RelationStatus::None => Err(ApiError::UserNotFound),
        RelationStatus::Incoming | RelationStatus::Outgoing | RelationStatus::Friend => {
            let mut session = db
                .client
                .start_session(None)
                .await
                .context("remove_friend: Failed to start mongodb session")?;

            let (chat_id, message) = session
                .with_transaction(
                    (
                        &db.users::<User>(),
                        &db.chats::<Chat>(),
                        sender_id,
                        receiver_id,
                        relationship,
                    ),
                    |session, (users, chats, sender_id, receiver_id, relationship)| {
                        async move {
                            users
                                .update_one_with_session(
                                    doc! {
                                        "_id": *receiver_id,
                                    },
                                    doc! {
                                        "$pull": {
                                            "profile.relations": {
                                                "id": *sender_id,
                                            }
                                        }
                                    },
                                    None,
                                    session,
                                )
                                .await?;

                            users
                                .update_one_with_session(
                                    doc! {
                                        "_id": *sender_id,
                                    },
                                    doc! {
                                        "$pull": {
                                            "profile.relations": {
                                                "id": *receiver_id,
                                            }
                                        }
                                    },
                                    None,
                                    session,
                                )
                                .await?;

                            if *relationship == RelationStatus::Friend {
                                let chat = chats
                                    .find_one_with_session(
                                        doc! {
                                            "chatType": ChatType::Direct.to_string(),
                                            "recipients.id": {
                                                "$all": [*sender_id, *receiver_id]
                                            }
                                        },
                                        None,
                                        session,
                                    )
                                    .await?;

                                match chat {
                                    Some(chat) => {
                                        Ok((Some(chat.id), "Friend removed.".to_string()))
                                    }
                                    None => Ok((None, "Friend removed.".to_string())),
                                }
                            } else if *relationship == RelationStatus::Incoming {
                                Ok((None, "Friend request canceled.".to_string()))
                            } else {
                                Ok((None, "Friend request declined.".to_string()))
                            }
                        }
                        .boxed()
                    },
                    None,
                )
                .await
                .context("remove_friend: Failed to remove friend: transaction failed")?;
            Ok(RemoveFriendResponse {
                user: RemoveFriendUser {
                    id: receiver_user.account.id,
                },
                message,
                chat_id,
            })
        }
    }
}
