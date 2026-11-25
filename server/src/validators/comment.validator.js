const { z } = require('./common');

const create = z.object({ body: z.string().trim().min(1, 'Comment cannot be empty').max(2000) });

module.exports = { create };
