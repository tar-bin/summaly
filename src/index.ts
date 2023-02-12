/**
 * summaly
 * https://github.com/syuilo/summaly
 */

import * as URL from 'url';
import tracer from 'trace-redirect';
import Summary from './summary.js';
import type { IPlugin as _IPlugin } from './iplugin.js';
export type IPlugin = _IPlugin;
import general from './general.js';
import * as Got from 'got';
import { setAgent } from './utils/got.js';
import type { FastifyInstance } from 'fastify';
import { plugins as builtinPlugins } from './plugins/index.js';

type Options = {
	/**
	 * Accept-Language for the request
	 */
	lang?: string | null;

	/**
	 * Whether follow redirects
	 */
	followRedirects?: boolean;

	/**
	 * Custom Plugins
	 */
	plugins?: IPlugin[];

	/**
	 * Custom HTTP agent
	 */
	agent?: Got.Agents;
};

type Result = Summary & {
	/**
	 * The actual url of that web page
	 */
	url: string;
};

const defaultOptions = {
	lang: null,
	followRedirects: true,
	plugins: [],
} as Options;

/**
 * Summarize an web page
 */
export const summaly = async (url: string, options?: Options): Promise<Result> => {
	if (options?.agent) setAgent(options.agent);

	const opts = Object.assign(defaultOptions, options);

	const plugins = builtinPlugins.concat(opts.plugins || []);

	const actualUrl = opts.followRedirects ? await tracer(url).catch(() => url) : url;

	const _url = URL.parse(actualUrl, true);

	// Find matching plugin
	const match = plugins.filter(plugin => plugin.test(_url))[0];

	// Get summary
	const summary = await (match ? match.summarize : general)(_url, opts.lang || undefined);

	if (summary == null) {
		throw 'failed summarize';
	}

	return Object.assign(summary, {
		url: actualUrl
	});
};

export default function (fastify: FastifyInstance, options: {}, done: (err?: Error) => void) {
	fastify.get<{
        Querystring: {
				url?: string;
				lang?: string;
			};
	}>('/', async (req, reply) => {
		const url = req.query.url as string;
		if (url == null) {
			return reply.status(400).send({
				error: 'url is required'
			});
		}

		try {
			const summary = await summaly(url, {
				lang: req.query.lang as string,
				followRedirects: false,
			});

			return summary;
		} catch (e) {
			return reply.status(500).send({
				error: e
			});
		}
	});

	done();
}