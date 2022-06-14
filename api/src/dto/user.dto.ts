import { Account, RelationStatus, User } from '@prisma/client';

export interface UserDto {
    id: string;
    isOwner: boolean | null;
    username: string;
}

export interface AccountUserDto extends Account {
    user: User;
}
export enum RelationshipStatusWithNone {
    None = 'None',
}
export interface getUserRelations {
    relationship: RelationStatus | RelationshipStatusWithNone;
    online: boolean;
    id: string;
    username: string;
}
export interface RelatedUsersDto {
    account: AccountUserDto | null;
    users: getUserRelations[];
}
