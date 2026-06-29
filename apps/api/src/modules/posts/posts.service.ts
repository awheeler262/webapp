import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PostsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.post.findMany({
      where: { published: true },
      include: { author: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: { author: { select: { id: true, name: true } } },
    });
    if (!post) throw new NotFoundException('Post not found');
    return post;
  }

  async create(authorId: string, data: { title: string; body: string }) {
    return this.prisma.post.create({
      data: { ...data, authorId },
    });
  }

  async update(id: string, authorId: string, data: { title?: string; body?: string; published?: boolean }) {
    const post = await this.findOne(id);
    if (post.author.id !== authorId) throw new ForbiddenException();
    return this.prisma.post.update({ where: { id }, data });
  }

  async remove(id: string, authorId: string) {
    const post = await this.findOne(id);
    if (post.author.id !== authorId) throw new ForbiddenException();
    return this.prisma.post.delete({ where: { id } });
  }
}
