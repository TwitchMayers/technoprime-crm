import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma.service';
import { EventsService } from '../events/events.service';
import { InventoryService } from '../inventory/inventory.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { SharingSystemsService } from '../sharing-systems/sharing-systems.service';

describe('OrdersService', () => {
  let service: OrdersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: PrismaService,
          useValue: {},
        },
        {
          provide: EventsService,
          useValue: {},
        },
        {
          provide: InventoryService,
          useValue: {},
        },
        {
          provide: SubscriptionsService,
          useValue: {},
        },
        {
          provide: SharingSystemsService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
