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

	async function findComment() {
		const outVars = {
			comment_id: "",
			comment_body: "",
		};

		if (!searchTerm) {
			setFailed("Please enter a search them");
			return outVars;
		}

		// eventName === "pull_request"

		const body = context.eventName === "issue_comment"
      	? context.payload.comment.body
      	: context.payload.pull_request.body || "";

		console.log("context eventName", context.eventName);
		console.log("CONTEXT", context);

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
			info(`Comment found for a search term: '${searchTerm}'.`);
			info(`Comment ID: '${foundComment.id}'.`);

			return {
				comment_id: foundComment.id,
				comment_body: foundComment.body,
			};
		}

		info("Comment not found.");

		return {
			comment_id: "",
			comment_body: "",
		};
	}

	try {
		const repository = getInput("repository");
		[owner, repo] = repository
			? repository.split("/")
			: process.env.GITHUB_REPOSITORY.split("/");
		issueNumber = getInput("number");
		searchTerm = getInput("search_term");

		let outVars = { comment_id: "", comment_body: "" };
		outVars = await findComment();

		info(`comment_id : ${outVars.comment_id}`);
		info(`comment_body : ${outVars.comment_body}`);

		setOutput("comment_id", outVars.comment_id);
		setOutput("comment_body", outVars.comment_body);
	} catch (error) {
		setFailed(error.message);
	}
}

run();
