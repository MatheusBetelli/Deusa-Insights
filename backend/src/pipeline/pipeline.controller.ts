import { Controller, Get, Param, Query, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedHttpRequest } from "../common/auditable-http.types";
import { PipelineQueryDto } from "./dto/pipeline-query.dto";
import { PipelineService } from "./pipeline.service";

@UseGuards(AuthGuard)
@Controller("pipeline")
export class PipelineController {
  constructor(private readonly pipelineService: PipelineService) {}

  @Get()
  findAll(@Query() query: PipelineQueryDto, @Req() request: AuthenticatedHttpRequest) {
    return this.pipelineService.findAll(query, request.user);
  }

  @Get("stage/:status")
  findStage(
    @Param("status") status: string,
    @Query() query: PipelineQueryDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    return this.pipelineService.findStage(status, query, request.user);
  }
}
