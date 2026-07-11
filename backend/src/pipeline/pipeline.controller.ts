import { Controller, Get, Param, Query } from "@nestjs/common";
import { PipelineQueryDto } from "./dto/pipeline-query.dto";
import { PipelineService } from "./pipeline.service";

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
