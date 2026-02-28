import { NextResponse } from 'next/server';
import { db, orders, orderLineItems } from '@/db';
import { eq, desc } from 'drizzle-orm';

// GET /api/orders - List orders
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');

  try {
    const ordersList = await db.select()
      .from(orders)
      .orderBy(desc(orders.createdAt))
      .limit(limit)
      .offset(offset);

    // Get line items for each order
    const ordersWithItems = await Promise.all(
      ordersList.map(async (order) => {
        const items = await db.select()
          .from(orderLineItems)
          .where(eq(orderLineItems.orderId, order.id));

        return { ...order, lineItems: items };
      })
    );

    // Get total count
    const allOrders = await db.select().from(orders);

    return NextResponse.json({
      orders: ordersWithItems,
      total: allOrders.length,
      limit,
      offset,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
