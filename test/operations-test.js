require('mocha')
var expect = require('chai').expect
var assert = require('chai').assert
const tu = (one, two) => one * two
const EventEmitter = require('events')

const DataService = require('../abstract-data-service-node')

function show(dat) {
	console.log(JSON.stringify(dat, null, '\t'))

}

class DataServiceMock extends DataService {
	constructor(options) {
		super(options)
	}
	async _doInternalFetch(collection, query) {
		return new Promise(async (resolve, reject) => {
			if(Array.isArray(query)) {
				let result = []
				try {
					for(let subquery of query) {
						let subresult = await this._doInternalFetch(collection, subquery)
						result.push(...subresult)
					}
				}
				catch(e) {
					return reject(e)
				}
				return resolve(result)
			}
			
			if(!query || Object.keys(query).length == 0) {
				return resolve([...collection])
			}
			let result = collection.filter(item => item._id == query._id || item.id == query.id)
			resolve(result)
		})
	}

	async _doInternalSave(collection, focus) {
		let p = new Promise(async (resolve, reject) => {
			let type = 'update'
			if(!focus._id) {
				focus._id = this.generateId()
				type = 'create'
			}
			else {
				await this._doInternalRemove(collection, focus)
			}
			collection.push(focus)
			return resolve([focus, type, null])
		})
		return p
	}
	async _doInternalRemove(collection, query) {
		return new Promise((resolve, reject) => {
			for(let i = 0; i < collection.length; i++) {
				if(collection[i]._id == query._id || collection[i].id == query.id) {
					collection.splice(i, 1)
					break;
				}
			}

			resolve(query)
		})
	}
}

describe("basic data operations", async function () {

	it("independent ids", function () {
		let col = []
		col.collectionName = 'default'
		let serv = new DataService({
			collections: {
				default: col
			}
		})
		assert.equal(serv.useIndependentIds, true)
		
		let id = serv.generateId()
		assert.isNotNull(id)

		serv = new DataService({
			collections: {
				default: col
			}
			, useIndependentIds: false
		})
		assert.equal(serv.useIndependentIds, false)

	})

	it("ops", async function () {
		let p = new Promise(async (resolve, reject) => {
			try {
				let col = []
				col.collectionName = 'default'
				let events = new EventEmitter()
				serv = new DataServiceMock({
					collections: {
						default: col
					}
					, notification: events
				})
				
				events.on('object-change', (one, two) => {
					console.log(`object change: ${JSON.stringify(one)} ${two}`)
				})

				let dat = {
					msg: 'hello'
				}
				let [r] = await serv.save(Object.assign({}, dat))
				assert.isNotNull(r._id)
				// Make sure we have an independent id
				assert.isNotNull(r.id)
				let id = r._id
				let id2 = r.id

				let result = await serv.fetch()
				assert.equal(result.length, 1)

				result = await serv.fetchOne(id)
				assert.equal(result.msg, 'hello')

				result = await serv.fetchOne(id.toString())
				assert.equal(result.msg, 'hello')
				
				result.msg = 'hi'
				await serv.save(result)
				
				result = await serv.fetchOne(id.toString())
				assert.equal(result.msg, 'hi')

				result = await serv.fetchOne({id: id2})
				assert.equal(result.msg, 'hi')

				result = await serv.fetchOne(id2)
				assert.equal(result.msg, 'hi')

				result = await serv.remove(id.toString())

				result = await serv.fetchOne(id.toString())
				assert.isNull(result)
				
				
				let promises = serv.saveMany([
					{msg: 'hello'}
					, {msg: 'world'}
				])
				await Promise.all(promises)

				result = await serv.fetch()
				assert.equal(result.length, 2)
				
				let ids = result.map(item => item.id)
				let ids2 = result.map(item => item._id.toString())
				
				result = await serv.fetch({})
				assert.equal(result.length, 2)
				
				result = await serv.fetchOne(ids)
				assert.isNotNull(result)

				result = await serv.fetchOne(ids2)
				assert.isNotNull(result)
				
				result = await serv.fetch(serv.createIdQuery(ids))
				assert.equal(result.length, 2)

				result = await serv.fetch(serv.createIdQuery(ids2))
				assert.equal(result.length, 2)
				
				result = await serv.fetch({name: 'Kolz'})
				assert.equal(result.length, 0)


				// with independent ids turned off
				serv.useIndependentIds = false
				let native
				[r, native] = await serv.save({msg: 'world'})
				assert.isNotNull(r._id)
				// Make sure we don't have an independent id
				assert.isUndefined(r.id)
				

			}
			catch(e) {
				console.log(e)
				return reject('error')
			}
			resolve()
		})
		return p
	})
})