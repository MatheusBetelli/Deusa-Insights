import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { PipelineQueryDto } from "./dto/pipeline-query.dto";
import { PipelineService } from "./pipeline.service";

@UseGuards(AuthGuard)
@Controller("pipeline")
export class PipelineController {
  constructor(private readonly pipelineService: PipelineService) {}

  @Get()
  findAll(@Query() query: PipelineQueryDto) {
    return this.pipelineService.findAll(query);
  }

  @Get("stage/:status")
  findStage(@Param("status") status: string, @Query() query: PipelineQueryDto) {
    return this.pipelineService.findStage(status, query);
  }
}
