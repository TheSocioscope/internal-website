const { makeHandler } = require('../crud')

exports.handler = makeHandler('resources', {
  filter: (items, params) => {
    if (params.tag) return items.filter(i => i.tags?.includes(params.tag))
    return items
  },
})
