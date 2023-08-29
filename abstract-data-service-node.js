const DataService = require('./abstract-data-service')
const crypto = require("crypto");

class DataServiceNode extends DataService {
	/**
	 * Generates storage system independent random ids
	 * @returns a base64 string, 256 bits of randomness
	 */
	generateId() {
		return crypto.randomBytes(32).toString("base64url");
	}

}

module.exports = DataServiceNode
