const filog = require('filter-log')
const addCallbackToPromise = require('add-callback-to-promise')


class DataService {

	/**
	 * 
	 * @param {object} options
 	 * @param {string} [options.serviceName] Sets the name of this service for logging, and possibly other purposes
 	 * @param {boolean} [options.useIndependentIds] If true, records will get unique ID strings which are not tied to the underylying datastore
 	 * @param {object} options.collections an object holding the MongoDB collections this service will use, keyed by collection name
 	 * @param {object} [options.collections.default] the default collection. Technically optional, but the basic functions which
	 * don't require the caller to specify the collection won't work if not set.
	 * @param {EventEmitter} [options.notification] An EventEmitter that will be notified on create, update, and delete. The notification is:
	 * emit('object-change', { the object }, changeType: create, update, delete)
	 * @param {string} [options.eventName] The event name which will be used for the emitter. By default this is 'object-change'.
	 * 
	 */
	constructor({serviceName = 'dataService', useIndependentIds = true, eventName = 'object-change'} = {}) {
		Object.assign(this, {
			log: filog(serviceName + ':')
			, collections: {}
			, useIndependentIds: useIndependentIds
			, eventName: eventName
		}, arguments[0])
	}
	
	/**
	 * EXTENDING CLASSES MUST IMPLEMENT THIS METHOD.
	 * Generates storage system independent random ids
	 * @returns a string
	 */
	generateId() {
		throw new Error('generateId not implemented')
		/*
			check out abstract-data-service-node and abstract-data-service-browser for implementations
		*/
	}
	
	/**
	 * Finds documents via a MongoDB query object
	 * @param {object} query 
	 * @returns An array of resultant objects, possibly empty.
	 */
	async fetch(query) {
		return this._fetchByQuery(this.collections.default, query)
	}
	
	/**
	 * Fetch a single document.
	 * @param {*} id A query or a string which is the id
	 * @returns Either a single document or null
	 */
	async fetchOne(id) {
		let items = await this._fetchById(this.collections.default, id)
		if(items && items.length > 0) {
			return items[0]
		}
		return null
	}
	/**
	 * Store a document. It will replace or insert if there's no _id member
	 * @param {*} focus 
	 * @returns A promise that resolves to the saved object and the native mongo result
	 * in an result object [obj, native]
	 */
	async save(focus) {
		return this._save(this.collections.default, focus) 
	}
	/**
	 * Stores an array of documents. Returns an array of promises.
	 * @param {array} foci 
	 * @returns 
	 */
	saveMany(foci) {
		return this._saveMany(this.collections.default, foci) 
	}
	/**
	 * Removes one of more documents. This assumes the id is actually just an id,
	 * but will work fine if a broader query is passed.
	 * @param {*} id A query or a string which is the id
	 * @returns 
	 */
	async remove(id) {
		return this._removeByQuery(this.collections.default, this.createIdQuery(id))
	}

	/**
	 * Creates an object to query the db by an object's ID
	 * @param {*} id 
	 * @returns 
	 */
	createIdQuery(id) {
		if (Array.isArray(id)) {
			return id.map(this.createIdQuery)
		}
		if (typeof id === 'string') {
			return {
				$or: [{
					_id: id
				}
				, {
					id: id
				}]
			}
		}
		return id
	}

	/**
	 * Transforms the results of fetches. This is sometimes done when the object from the database should be augmented
	 * with additional information or should be converted into an object with a specific class. Override this function
	 * at need. By default it does essentially nothing.
	 * @param {object[]} result An array of objects from the database
	 * @param {string} collectionName The name of the collection these objects came from. If this class only queries a single
	 * collection, this parameter won't be of much use. If it queries multiple collection, this will help inform the method
	 * what to do with the object.
	 * @returns A promise which results in an array of objects.
	 */
	async postFetchesProcessor(result, collectionName) {
		return new Promise((resolve, reject) => {
			resolve(result)
		})
	}

	/**
	 * The internal implementation of fetching objects
	 * @param {object} collection Could be anyting. An array, a mongo collection, even just a string to 
	 * identify what underlying datastore to use
	 * @param {object|array} query An object in the mongodb query style, or an array of those objects
	 * @returns a promise which resolves to the result of the fetch, generally an array of result objects.
	 */
	async _doInternalFetch(collection, query) {
		throw new Error('_doInternalFetch not implemented')
		/*
			// Code will look something like this:

			return new Promise((resolve, reject) => {
				resolve([{}])
			})
		*/
	}
	
	/**
	 * Fetches a list of documents from the collection.
	 * @param {Collection} collection A MongoDB Collection
	 * @param {object,array} query A mongodb query object. Can me null or {} if you want all documents. 
	 * @param {function} callback (optional) A callback if that's how you get down. This function would normally be used with promises and await.
	 * @returns A promise which resolves to an array of documents
	 */
	_fetchByQuery(collection, query = {}, callback) {
		let p = new Promise((resolve, reject) => {
			this._doInternalFetch(collection, query).then(result => {
				this.postFetchesProcessor(result, collection.collectionName).then((processed) => {
					resolve(processed)
				})
			}).catch(err => {
				this.log.error(err)
				return reject(err)
			})
		})
		return addCallbackToPromise(p, callback)
	}
	
	/**
	 * EXTENDING CLASSES MUST IMPLEMENT THIS METHOD.
	 * The internal implementation of removing objects based on a query.
	 * @param {object} collection Could be anyting. An array, a mongo collection, even just a string to 
	 * identify what underlying datastore to use
	 * @param {object|array} query An object in the mongodb query style, or an array of those objects
	 * @returns a promise which resolves to the result of the delete, generally an internal result object
	 */
	async _doInternalRemove(collection, query) {
		throw new Error('_doInternalRemove not implemented')
		/*
			// Code will look something like this:

			return new Promise((resolve, reject) => {
				resolve(query)
			})
		*/
	}
	
	_removeByQuery(collection, query = {}, callback) {
		let p = new Promise((resolve, reject) => {
			this._doInternalRemove(collection, query).then(result => {
				this._notify(query, 'delete')
				resolve(result)
			}).catch(err => {
				this.log.error(err)
				return reject(err)
			})
		})
		return addCallbackToPromise(p, callback)
	}

	/**
	 * Fetches a list of documents from the collection.
	 * 
	 * @param {Collection} collection A MongoDB Collection
	 * @param {*} id A query. If it's an object, that's used directly. If it's a string, we'll try to turn it into a MongoDB style ID query object.
	 *  If an array is passed, each element is assumed to be an id of the objects to fetch.
	 * @param {function} callback (optional) A callback if that's how you get down. This function would normally be used with promises and await.
	 * @returns A promise which resolves to an array of documents containing either one of zero items
	 */
	_fetchById(collection, id, callback) {
		return this._fetchByQuery(collection, this.createIdQuery(id), callback)
	}
	

	/**
	 * EXTENDING CLASSES MUST IMPLEMENT THIS METHOD.
	 * The internal implementation of saving objects, either insert or update. 
	 * @param {object} collection Could be anyting. An array, a mongo collection, even just a string to 
	 * identify what underlying datastore to use
	 * @param {object} focus An object to save
	 * @returns a promise which resolves to the result of the save, an array of the [result, change-type(update,create), native-result].
	 */
	async _doInternalSave(collection, focus) {
		throw new Error('_doInternalSave not implemented')
		/*
			// Code will look something like this:

			let p = new Promise((resolve, reject) => {
				return resolve([focus, 'update', null])
			})
			return p
		*/
	}

	/**
	 * Saves an object. If it already has an _id attribute, it replaces the existing document, otherwise inserts it.
	 * @param {Collection} collection A MongoDB Collection
	 * @param {object} focus The object to save
	 * @param {function} callback (optional) A callback if that's how you get down. This function would normally be used with promises and await.
	 * @returns Promise
	 */
	async _save(collection, focus, callback) {
		let p = new Promise((resolve, reject) => {
			if(this.useIndependentIds && !focus.id) {
				focus.id = this.generateId()
			}
			this._doInternalSave(collection, focus).then(([saved, saveType, nativeResult]) => {
				this._notify(saved, saveType)
				return resolve([saved, nativeResult])
			})
			.catch(err => {
				reject(err)
			})
		})
		return addCallbackToPromise(p, callback)
	}

	
	/**
	 * Saves an array of objects. If the objects already have an _id attribute, it replaces the existing document, otherwise inserts it.
	 * @param {Collection} collection A MongoDB Collection
	 * @param {object[]} foci An array of objects to save
	 * @param {function} callback (optional) A callback if that's how you get down. Called when Promise.all is done. This function would normally be used with promises and await.
	 * @returns Array An array of promises which represent saves for each object in the array. If you want to wait on the results, try:
	 * 		Promise.all(service._saveMany(col, items)).then(result => {
	 * 			// some code
	 * 		})
	 * 	or
	 * 		await Promise.all(service._saveMany(col, items))
	 */
	_saveMany(collection, foci, callback) {
		let promises = []
		for(let focus of foci) {
			promises.push(this._save(collection, focus))
		}	
		if(callback) {
			addCallbackToPromise(Promise.all(promises), callback)
		}	
		return promises
	}
	
	_notify(obj, type) {
		if(this.notification) {
			this.notification.emit(this.eventName, obj, type)
		}
	}
}

module.exports = DataService