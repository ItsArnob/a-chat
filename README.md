<p align="center">
  <img src="https://raw.githubusercontent.com/ItsArnob/a-chat/main/.github/screenshots/screenshot_chat_browser_window.png">
</p>
<p align="center">Name TBD</p>

# Name TBD

TODO

Found a bug or want to request a feature? Feel free to create an issue! (template coming soon:tm:)

## Installation

Setting up your own instance is easy (dockerfile coming soon:tm:)

### Requirements

-   NodeJS LTS 16.16.0 (might work with others versions, not tested.)
-   yarn package manager
-   MongoDB 5.0

### steps

-   create database indexes using the script located at `api/scripts/initDb.js` (well, that currently doesn't exist)
-   create the file `web/.env` and set the `VITE_API_URL` environment variable
-   create the file `api/.env` and set the following environment variables:
    -   `JWT_SECRET` - random string that will be used to sign the jwt tokens (required)
    -   `DB_URI` - your mongodb instances connection string (required, defaults to localhost)
    -   `DB_NAME` - the database name to use (optional, defaults to a_chat)
    -   `PORT` - the port on which the API will listen on (optional, defaults to 5000)
    -   `TRUST_PROXY` - set it to a truthy string if the API is behind a proxy (optional, defaults to false)
    -   `CORS_ALLOWED_DOMAINS` - set it to the address of the web client (optional but should be set, otherwise the client wont be able to make requests) [can have multiple values, separated by space]
-   run `yarn install` and `yarn build`
-   start everything with `yarn start`

## Roadmap

see the current roadmap for the alpha release here: [https://github.com/ItsArnob/a-chat/milestone/1](https://github.com/ItsArnob/a-chat/milestone/1)
