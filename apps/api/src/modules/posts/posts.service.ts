import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post } from './entities/post.entity';

const POST_SELECT = {
  id: true,
  title: true,
  body: true,
  published: true,
  authorId: true,
  createdAt: true,
  updatedAt: true,
  author: { id: true, name: true },
} as const;

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post) private postsRepository: Repository<Post>,
  ) {}

  async findAll() {
    return this.postsRepository.find({
      where: { published: true },
      relations: { author: true },
      select: POST_SELECT,
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    const post = await this.postsRepository.findOne({
      where: { id },
      relations: { author: true },
      select: POST_SELECT,
    });
    if (!post) throw new NotFoundException('Post not found');
    return post;
  }

  async create(authorId: string, data: { title: string; body: string }) {
    return this.postsRepository.save(
      this.postsRepository.create({ ...data, authorId }),
    );
  }

  async update(id: string, authorId: string, data: { title?: string; body?: string; published?: boolean }) {
    const post = await this.findOne(id);
    if (post.author.id !== authorId) throw new ForbiddenException();
    Object.assign(post, data);
    return this.postsRepository.save(post);
  }

  async remove(id: string, authorId: string) {
    const post = await this.findOne(id);
    if (post.author.id !== authorId) throw new ForbiddenException();
    await this.postsRepository.delete(id);
    return post;
  }
}
