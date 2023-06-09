import {
	getInput, info, setFailed, setOutput,
} from "@actions/core";
import { getOctokit, context } from "@actions/github";

async function run() {
	let owner;
	let repo;
	let issueNumber;
	let searchTerm;

	const token = getInput("token");
	const octokit = getOctokit(token);

	async function findSearchTerm() {
		const outVars = {
			comment_id: "",
			comment_body: "",
		};

		if (!searchTerm) {
			setFailed("Please enter a search them");
			return outVars;
		}

		// check in Description
		const { body } = context.payload.pull_request;

		if (body) {
			info("Comment found in Description");
			return {
				comment_id: body,
				comment_body: body,
			};
		}

		// check in Comments
		const args = {
			owner,
			repo,
			issue_number: issueNumber,
		};

		const listComments = await octokit.paginate(
			octokit.rest.issues.listComments,
			args,
		);

		const foundComment = listComments.find(
			(listComment) => listComment.body && listComment.body.includes(searchTerm),
		);

		if (foundComment) {
			info("Comment found in Comments section");
			info(`Comment found for a search term: '${searchTerm}'.`);
			info(`Comment ID: '${foundComment.id}'.`);

			return {
				comment_id: foundComment.id,
				comment_body: foundComment.body,
			};
		}

		info("Comment not found.");

		return outVars;
	}

	try {
		const repository = getInput("repository");
		[owner, repo] = repository
			? repository.split("/")
			: process.env.GITHUB_REPOSITORY.split("/");
		issueNumber = getInput("number");
		searchTerm = getInput("search_term");

		const outVars = await findSearchTerm();

		info(`comment_id : ${outVars.comment_id}`);
		info(`comment_body : ${outVars.comment_body}`);

		setOutput("comment_id", outVars.comment_id);
		setOutput("comment_body", outVars.comment_body);
	} catch (error) {
		setFailed(error.message);
	}
}

run();
