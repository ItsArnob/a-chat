import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { ObjectId } from 'mongodb';

@Injectable()
export class ObjectIdValidationPipe implements PipeTransform {
    transform(value: any) {
        if(!ObjectId.isValid(value)) throw new BadRequestException("Invalid ID.");
        return new ObjectId(value);
    }
}