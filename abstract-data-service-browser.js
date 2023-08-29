const DataService = require('./abstract-data-service')

class DataServiceBrowser extends DataService {
	/**
	 * Generates storage system independent random ids
	 * @returns a base64 string, 256 bits of randomness
	 */
	generateId() {
		let array = new Uint8Array(32)
		window.crypto.getRandomValues(array)
		let value = btoa(array)
		value = value.replace(/\//g, "_").replace(/\+/g, "-").replace(/=+$/, "")
		return value
	}

}

module.exports = DataServiceBrowser
