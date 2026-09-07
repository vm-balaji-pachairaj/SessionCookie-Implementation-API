import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { usePolicyNeeded } from '../casbin/casbin.decorator';
import { CasbinService } from '../casbin/casbin.service';
import type { TokenPayload } from '../app.service';

export interface OrderItem {
  id: string;
  orderId: string;
  customer: string;
  amount: number;
  status: string;
  createdDate: string;
}

export interface CustomerItem {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: string;
}

// In-memory data store for POC demonstration
const MOCK_ORDERS: OrderItem[] = [
  { id: '1', orderId: 'ORD-501', customer: 'Acme Corporation', amount: 15400, status: 'Completed', createdDate: '2026-03-01' },
  { id: '2', orderId: 'ORD-502', customer: 'Global Tech Ltd', amount: 8200, status: 'Processing', createdDate: '2026-03-02' },
  { id: '3', orderId: 'ORD-503', customer: 'Nexus Enterprises', amount: 24900, status: 'Pending Approval', createdDate: '2026-03-03' },
  { id: '4', orderId: 'ORD-504', customer: 'Summit Health Group', amount: 6750, status: 'Completed', createdDate: '2026-03-04' },
  { id: '5', orderId: 'ORD-505', customer: 'Horizon Logistics', amount: 11200, status: 'Shipped', createdDate: '2026-03-05' },
];

const MOCK_CUSTOMERS: CustomerItem[] = [
  { id: '1', name: 'John Doe', email: 'john@acme.com', phone: '+1-555-0101', status: 'Active' },
  { id: '2', name: 'Jane Smith', email: 'jane@globaltech.com', phone: '+1-555-0102', status: 'Active' },
  { id: '3', name: 'Robert Johnson', email: 'rjohnson@nexus.com', phone: '+1-555-0103', status: 'Pending' },
  { id: '4', name: 'Emily Davis', email: 'emily@summithealth.com', phone: '+1-555-0104', status: 'Active' },
  { id: '5', name: 'Michael Brown', email: 'mbrown@horizon.com', phone: '+1-555-0105', status: 'Inactive' },
];

@Controller('api')
export class ResourcesController {
  constructor(private readonly casbinService: CasbinService) {}

  // --------------------------------------------------------------------------
  // Sales Section Endpoints
  // --------------------------------------------------------------------------

  @Get('sales/overview')
  @usePolicyNeeded({ section: 'sales', access: 'read' })
  getSalesOverview(@Req() request: Request & { user?: TokenPayload }) {
    return {
      message: 'Sales overview retrieved successfully',
      metrics: {
        totalRevenue: 66450,
        totalOrders: 5,
        averageOrderValue: 13290,
        activeCustomers: 4,
      },
    };
  }

  @Get('sales/orders')
  @usePolicyNeeded({ section: 'sales', menu: 'orders', access: 'read' })
  async getOrders(@Req() request: Request & { user?: TokenPayload }) {
    const roleName = request.user?.userDetails?.role_name || '';

    // Field-level P3 enforcement: Check if user's role can view the amount field
    const canReadAmount = await this.casbinService.enforce(
      roleName,
      'hcp',
      'sales',
      'orders',
      'orders',
      'amount',
      'read',
    );

    // Filter fields according to Casbin field permissions
    const filteredOrders = MOCK_ORDERS.map((order) => {
      const copy = { ...order };
      if (!canReadAmount) {
        delete (copy as any).amount;
      }
      return copy;
    });

    return {
      message: 'Orders retrieved successfully',
      data: filteredOrders,
      fieldPermissions: {
        canReadAmount,
      },
    };
  }

  @Post('sales/orders')
  @usePolicyNeeded({ section: 'sales', menu: 'orders', access: 'create' })
  createOrder(
    @Body() body: { customer: string; amount: number; status?: string },
  ) {
    const newOrder: OrderItem = {
      id: String(MOCK_ORDERS.length + 1),
      orderId: `ORD-${500 + MOCK_ORDERS.length + 1}`,
      customer: body.customer,
      amount: body.amount || 0,
      status: body.status || 'Pending',
      createdDate: new Date().toISOString().split('T')[0],
    };
    MOCK_ORDERS.push(newOrder);
    return {
      message: 'Order created successfully',
      data: newOrder,
    };
  }

  @Put('sales/orders/:id')
  @usePolicyNeeded({ section: 'sales', menu: 'orders', access: 'update' })
  updateOrder(
    @Param('id') id: string,
    @Body() body: Partial<OrderItem>,
  ) {
    const index = MOCK_ORDERS.findIndex((o) => o.id === id);
    if (index === -1) {
      throw new ForbiddenException(`Order #${id} not found`);
    }
    MOCK_ORDERS[index] = { ...MOCK_ORDERS[index], ...body };
    return {
      message: `Order #${id} updated successfully`,
      data: MOCK_ORDERS[index],
    };
  }

  @Delete('sales/orders/:id')
  @usePolicyNeeded({ section: 'sales', menu: 'orders', access: 'delete' })
  deleteOrder(@Param('id') id: string) {
    const index = MOCK_ORDERS.findIndex((o) => o.id === id);
    if (index === -1) {
      throw new ForbiddenException(`Order #${id} not found`);
    }
    const [deleted] = MOCK_ORDERS.splice(index, 1);
    return {
      message: `Order #${id} deleted successfully`,
      data: deleted,
    };
  }

  // --------------------------------------------------------------------------
  // Customers Section Endpoints
  // --------------------------------------------------------------------------

  @Get('customers')
  @usePolicyNeeded({ section: 'customers', menu: 'customer_list', access: 'read' })
  getCustomers(@Req() request: Request & { user?: TokenPayload }) {
    return {
      message: 'Customer directory retrieved successfully',
      data: MOCK_CUSTOMERS,
    };
  }

  @Post('customers')
  @usePolicyNeeded({ section: 'customers', menu: 'customer_list', access: 'create' })
  createCustomer(@Body() body: Partial<CustomerItem>) {
    const newCustomer: CustomerItem = {
      id: String(MOCK_CUSTOMERS.length + 1),
      name: body.name || 'New Customer',
      email: body.email || '',
      phone: body.phone || '',
      status: body.status || 'Active',
    };
    MOCK_CUSTOMERS.push(newCustomer);
    return {
      message: 'Customer created successfully',
      data: newCustomer,
    };
  }

  // --------------------------------------------------------------------------
  // Reports Section Endpoints
  // --------------------------------------------------------------------------

  @Get('reports/sales')
  @usePolicyNeeded({ section: 'reports', menu: 'sales_report', access: 'read' })
  getSalesReport() {
    return {
      message: 'Sales report generated successfully',
      data: {
        summary: 'Q1 Sales Growth: +18.4%',
        monthlyTrend: [
          { month: 'Jan', revenue: 19500 },
          { month: 'Feb', revenue: 22400 },
          { month: 'Mar', revenue: 24550 },
        ],
      },
    };
  }

  @Get('reports/audit')
  @usePolicyNeeded({ section: 'reports', menu: 'audit_report', access: 'read' })
  getAuditReport() {
    return {
      message: 'Audit report retrieved successfully',
      data: [
        { id: 1, action: 'Role Policy Updated', user: 'admin', timestamp: '2026-03-05 10:20:00' },
        { id: 2, action: 'Bundle Assigned to Role', user: 'admin', timestamp: '2026-03-05 11:45:12' },
        { id: 3, action: 'User Permissions Refreshed', user: 'system', timestamp: '2026-03-05 12:00:00' },
      ],
    };
  }
}

