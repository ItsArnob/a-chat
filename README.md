<p align="center">
  <img src="https://raw.githubusercontent.com/ItsArnob/a-chat/main/.github/screenshots/screenshot_chat_browser_window.png">
</p>
<p align="center">Name TBD</p>

# This is the fully working NodeJS branch.
# A work-in-progress rust rewrite can be found in [rewrite-backend](https://github.com/ItsArnob/a-chat/tree/rewrite-backend) branch.

TODO

Found a bug or want to request a feature? Feel free to create an issue! (template coming soon:tm:)

## Installation

Setting up your own instance is easy (dockerfile coming soon:tm:)

### Requirements

-   NodeJS LTS 16.16.0 (might work with others versions, not tested.)
-   Yarn package manager
-   MongoDB 5.0

### steps

-   Create the file `web/.env` and set the `VITE_API_URL` environment variable
-   Create the file `api/.env` and set the following environment variables:
    -   `DB_URI` - Your mongodb instance's connection string (Optional, defaults to localhost)
    -   `DB_NAME` - The database name to use (Optional, defaults to `a_chat`)
    -   `PORT` - The port on which the API will listen on (Optional, defaults to `5000`)
    -   `TRUST_PROXY` - Set it to a truthy string if the API is behind a proxy (Optional, defaults to `false`)
    -   `CORS_ALLOWED_DOMAINS` - Set it to the address of the web client (Optional but should be set, otherwise the client wont be able to make requests) [Can have multiple values, separated by space]
    - `SESSION_MAX_AGE` - Idle session expiry timeout. (Optional, defaults to `1209600000
` or 14 days.) [Should be in miliseconds]
    - `LOG_LEVEL` - Log level for pino logger. (Optional, defaults to `info`)
    - `DISABLE_REQUEST_LOGGING` - Disables all request logging. (Optional, defaults to `false`)
    - `DISABLE_SIGNUP` - Disables user registration. (Optional, defaults no `false`) [Set it to any truthy value.]
    - Socketio admin:
        - `SOCKETIO_ADMIN_USERNAME` - Socketio admin interface username (Required, if you want to use socketio admin interface)
        - `SOCKETIO_ADMIN_PASSWORD_HASH` - Bcrypt hash representation of a password for socketio admin interface (Required, if you want to use socketio admin interface)
        
      NOTE: ***Both*** values need to be set to enable socketio admin.

-   Run `yarn install` and `yarn build`
-   Create database indexes using the script located at [`api/scripts/initDb.mjs`](api/scripts/initDb.mjs)
-   Start everything with `yarn start`

## Roadmap

See the current roadmap for the alpha release here: [https://github.com/ItsArnob/a-chat/milestone/1](https://github.com/ItsArnob/a-chat/milestone/1)
