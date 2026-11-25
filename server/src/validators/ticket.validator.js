const { z, objectId } = require('./common');
const { TICKET_STATUS, TICKET_PRIORITY, TICKET_CATEGORY } = require('../config/constants');

const status = z.enum(Object.values(TICKET_STATUS));
const priority = z.enum(Object.values(TICKET_PRIORITY));
const category = z.enum(Object.values(TICKET_CATEGORY));

const title = z.string().trim().min(5, 'Title must be at least 5 characters').max(120);
const description = z.string().trim().min(10, 'Description must be at least 10 characters').max(5000);

const create = z.object({ title, description, category: category.default('general'), priority: priority.default('medium') });

const update = z
  .object({ title, description, category, priority })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Provide at least one field to update');

const updateStatus = z.object({ status });
const assign = z.object({ assignedTo: objectId.nullable() });

const SORT_FIELDS = ['createdAt', 'updatedAt', 'priority', 'status', 'title'];

const list = z.object({
  status: status.optional(),
  priority: priority.optional(),
  category: category.optional(),
  q: z.string().trim().max(100).optional(),
  createdBy: objectId.optional(),
  assignedTo: z.union([objectId, z.literal('me'), z.literal('none')]).optional(),
  sort: z
    .string()
    .regex(new RegExp(`^-?(${SORT_FIELDS.join('|')})$`), `sort must be one of ${SORT_FIELDS.join(', ')} (prefix - for desc)`)
    .default('-createdAt'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

module.exports = { create, update, updateStatus, assign, list };
