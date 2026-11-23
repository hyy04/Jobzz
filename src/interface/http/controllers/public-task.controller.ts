import { FastifyRequest, FastifyReply } from 'fastify';
import { BrowsePublicTasksUseCase } from '../../../usecase/browse-public-tasks.usecase';
import { GetPublicTaskDetailsUseCase } from '../../../usecase/get-public-task-details.usecase';
import { PublicTaskListQuerySchema, TaskIdParamSchema } from '../dto/public-task.dto';

/**
 * Controller điều phối các yêu cầu xem và duyệt nhiệm vụ công khai
 * @ears .sdd/features/browse-and-claim-task/SPEC.md#REQ-BCT-001..008
 */
export class PublicTaskController {
  constructor(
    private readonly browseUseCase: BrowsePublicTasksUseCase,
    private readonly getDetailsUseCase: GetPublicTaskDetailsUseCase
  ) {}

  public browse = async (request: FastifyRequest, reply: FastifyReply) => {
    const validatedQuery = PublicTaskListQuerySchema.parse(request.query);
    const result = await this.browseUseCase.execute(validatedQuery);
    return reply.status(200).send(result);
  };

  public getDetails = async (request: FastifyRequest, reply: FastifyReply) => {
    const validatedParam = TaskIdParamSchema.parse(request.params);
    const result = await this.getDetailsUseCase.execute({ taskId: validatedParam.id });
    return reply.status(200).send({ data: result });
  };
}

