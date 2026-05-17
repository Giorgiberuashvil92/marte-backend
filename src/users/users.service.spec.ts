import { BadRequestException, ConflictException } from '@nestjs/common';
import { UsersService } from './users.service';

const mockModel = () => ({
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  updateOne: jest.fn(),
  countDocuments: jest.fn(),
  find: jest.fn(),
});

describe('UsersService', () => {
  let service: UsersService;
  const userModel = mockModel();
  const requestModel = mockModel();
  const loginHistoryModel = mockModel();
  const followModel = mockModel();
  const communityPostModel = mockModel();

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UsersService(
      userModel as any,
      requestModel as any,
      loginHistoryModel as any,
      followModel as any,
      communityPostModel as any,
    );
  });

  it('prevents following self', async () => {
    await expect(service.followUser('u1', 'u1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('throws when already following', async () => {
    jest
      .spyOn(service as any, 'findUserByIdOrThrow')
      .mockResolvedValue({ id: 'ok' } as any);
    followModel.findOne.mockResolvedValue({
      followerId: 'u1',
      followingId: 'u2',
    });

    await expect(service.followUser('u1', 'u2')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
