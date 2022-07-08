import { ULID_PATTERN } from '@/constants';
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { isString } from 'class-validator';


@Injectable()
export class UlidValidatorPipe implements PipeTransform {
    transform(value: any) {
        if(isString(value)) {
            if(value.length === 26 && ULID_PATTERN.test(value)) return value;
        }
        throw new BadRequestException("Invalid ID.");
    }
}