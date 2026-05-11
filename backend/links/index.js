const { makeHandler } = require('../crud')

exports.handler = makeHandler('links', {
  filter: (items, params) => {
    if (params.category) return items.filter(i => i.category === params.category)
    return items
  },
})
