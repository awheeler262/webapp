import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { PostsService } from './posts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('posts')
export class PostsController {
  constructor(private posts: PostsService) {}

  @Get()
  findAll() {
    return this.posts.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.posts.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Request() req, @Body() body: { title: string; body: string }) {
    return this.posts.create(req.user.id, body);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Request() req, @Body() body: { title?: string; body?: string; published?: boolean }) {
    return this.posts.update(id, req.user.id, body);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string, @Request() req) {
    return this.posts.remove(id, req.user.id);
  }
}
