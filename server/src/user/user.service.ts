import { Injectable } from '@nestjs/common';
import { User } from './interfaces/user.interface';

@Injectable()
export class UserService {
  // In-memory database
  private readonly users: User[] = [
    {
      id: '1',
      email: 'john@example.com',
      name: 'John Doe',
      password: 'password123', // In production, use hashed passwords
      tenants: ['acme', 'globex'],
    },
  ];

  findByEmail(email: string): User | undefined {
    return this.users.find((user) => user.email === email);
  }

  findById(id: string, tenantId: string): User | undefined {
    return this.users.find(
      (user) => user.id === id && user.tenants.includes(tenantId),
    );
  }

  findMe(userToFind: string): User {
    const user = this.users.find((user) => user.id === userToFind);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }
}
