import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { isNil, omitBy } from "lodash";
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

// TODO: FIX: this doesn't work with deeply nested data

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        
        return next.handle().pipe(
            map(data => {
                if(Array.isArray(data)) {
                    return data.map(item =>  typeof item == "object" ? omitBy(item, isNil) : item);
                }
                else if(typeof data == 'object') { 
                    return omitBy(data, isNil);
                } else return data;
            })
        )
    }
}