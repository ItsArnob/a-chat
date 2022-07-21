import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import onHeaders from 'on-headers';

@Injectable()
export class HeaderSessionMiddleware implements NestMiddleware {
    use(req: Request, res: Response, next: NextFunction) {
        const sidSigned = req.header("authorization")?.split("Bearer ")[1];
        if(sidSigned) {
            req.headers.cookie = `connect.sid=${sidSigned};`;
        }

        // fighting express-session so it doesn't send the signed sessionID 
        // in a cookie. I'll be manually signing the sessionID and pass it
        // to the client in the login route.
        
        onHeaders(res, function () {
            const cookies = this.getHeader("set-cookie");
            if (cookies) {
                res.removeHeader("set-cookie");
            }
        })
        next();
    }
}
