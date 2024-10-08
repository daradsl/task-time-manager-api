import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import * as bcrypt from 'bcrypt';
import { User } from 'src/database/entities/user.entity';
import { CreateUserDto } from 'src/user/dto/create-user.dto';
import { OAuth2Client } from 'google-auth-library';

@Injectable()
export class AuthService {
    private client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

    constructor(
        private readonly userService: UserService,
        private readonly jwtService: JwtService,
    ) { }

    async validateUser(email: string, password: string): Promise<User | null> {
        const user = await this.userService.getUserByEmail(email);
        if (user && user.password && await bcrypt.compare(password, user.password)) {
            return user;
        }
        return null;
    }

    async login(user: User) {
        const payload = { email: user.email, sub: user.id };
        return {
            access_token: this.jwtService.sign(payload),
        };
    }

    async validateGoogleToken(idToken: string) {
        try {
            const ticket = await this.client.verifyIdToken({
                idToken,
                audience: process.env.GOOGLE_CLIENT_ID,
            });

            const payload = ticket.getPayload();

            if (!payload?.email || !payload?.name) {
                throw new UnauthorizedException('Invalid Google token');
            }

            let user = await this.userService.getUserByEmail(payload.email);

            if (!user) {
                const createUserDto: CreateUserDto = {
                    email: payload.email,
                    name: payload.name,
                };
                user = await this.userService.createUser(createUserDto);
            }
            return user;
        } catch (error) {
            throw new UnauthorizedException('Invalid Google token');
        }
    }

    async loginWithGoogle(idToken: string) {
        const user = await this.validateGoogleToken(idToken);
        const payload = { email: user.email, sub: user.id };
        return {
            access_token: this.jwtService.sign(payload),
        };
    }
}
