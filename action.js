import { getInput, warning, info, setFailed, debug, setOutput } from '@actions/core';
import { getOctokit } from '@actions/github';
import { inspect } from 'util';

async function run() {
	let owner; let repo;
	let actionType; let body;
	let issueNumber; let commentId;
	let searchTerm; let author;
	let direction; let reactions;

	const allowedReactions = [
		'+1',
		'-1',
		'laugh',
		'hooray',
		'confused',
		'heart',
		'rocket',
		'eyes',
	];

	const token = getInput( 'token' );
	const octokit = getOctokit( token );

	async function addReactions( newCommentId ) {
		if ( !reactions ) {
			return;
		}

		const reactionsSet = [
			...new Set(
				reactions
					.replace( /\s/g, '' )
					.split( ',' )
					.filter( ( reaction ) => {
						if ( !allowedReactions.includes( reaction ) ) {
							warning( `Invalid reaction: '${reaction}` );
							return false;
						}
						return true;
					} ),
			),
		];

		if ( !reactionsSet ) {
			warning( `No valid reactions: '${reactions}` );
			return;
		}

		reactionsSet.map( async ( reaction ) => {
			await octokit.rest.reactions.createForIssueComment( {
				owner,
				repo,
				comment_id: newCommentId,
				content: reaction,
			} );
			info( `Reacted '${reaction}' on a comment.` );
		} );
	}

	async function createComment() {
		const outVars = {
			comment_id: '',
			comment_body: '',
		};

		if ( !issueNumber ) {
			setFailed( 'Issue number is required.' );
			return outVars;
		}

		if ( !body ) {
			setFailed( 'Comment body is required.' );
			return outVars;
		}

		const { data: comment } = await octokit.rest.issues.createComment( {
			owner,
			repo,
			issue_number: issueNumber,
			body,
		} );

		info( `Created a comment on issue number: ${issueNumber}` );
		info( `Comment ID: ${comment.id}` );

		await addReactions( comment.id );

		return {
			comment_id: comment.id,
			comment_body: comment.body,
		};
	}

	async function updateComment() {
		const outVars = {
			comment_id: '',
			comment_body: '',
		};

		if ( !commentId ) {
			setFailed( 'Comment ID is required.' );
			return outVars;
		}

		if ( !body ) {
			setFailed( 'Comment body is required.' );
			return outVars;
		}

		let newComment = body;

		if ( actionType === 'append' || actionType === 'prepend' ) {
			// Get an existing comment body.
			const { data: comment } = await octokit.rest.issues.getComment( {
				owner,
				repo,
				comment_id: commentId,
			} );

			if ( actionType === 'append' ) {
				newComment = `${comment.body}\n${body}`;
			}

			if ( actionType === 'prepend' ) {
				newComment = `${body}\n${comment.body}`;
			}
		}

		const { data: comment } = await octokit.rest.issues.updateComment( {
			owner,
			repo,
			comment_id: commentId,
			body: newComment,
		} );

		info( `Comment is modified. Comment ID: ${comment.id}` );

		await addReactions( comment.id );

		return {
			comment_id: comment.id,
			comment_body: comment.body,
		};
	}

	async function findComment() {
		const outVars = {
			comment_id: '',
			comment_body: '',
		};

		if ( !issueNumber ) {
			setFailed( 'Issue number is required.' );
			return outVars;
		}

		if ( !searchTerm && !author ) {
			setFailed( 'Either search term (search_term) or comment author (author) is required.' );
			return outVars;
		}

		const args = {
			owner,
			repo,
			issue_number: issueNumber,
		};

		let foundComment = false;

		if ( direction === 'older' ) {
			// eslint-disable-next-line no-restricted-syntax
			for await ( const { data: listComments } of
				octokit.paginate.iterator(
					octokit.rest.issues.listComments,
					args,
				)
			) {
				// Search a comment which included user comment.
				const comment = listComments.find(
					// eslint-disable-next-line no-loop-func
					( listComment ) => (
						( searchTerm && listComment.body ? listComment.body.includes( searchTerm ) : true )
						&& ( author && listComment.user ? listComment.user.login === author : true )
					),
				);

				// If a comment found, assign.
				if ( comment ) {
					foundComment = comment;
					break;
				}
			}
		} else {
			// Find a newer comment.
			const listComments = await octokit.paginate(
				octokit.rest.issues.listComments,
				args,
			);

			// Reverse the comments.
			listComments.reverse();

			// Search a comment which included user comment.
			const comment = listComments.find(
				( listComment ) => (
					( searchTerm && listComment.body ? listComment.body.includes( searchTerm ) : true )
					&& ( author && listComment.user ? listComment.user.login === author : true )
				),
			);

			// If a comment found, assign.
			if ( comment ) {
				foundComment = comment;
			}
		}

		if ( foundComment ) {
			info( `Comment found for a search term: '${searchTerm}'.` );
			info( `Comment ID: '${foundComment.id}'.` );

			return {
				comment_id: foundComment.id,
				comment_body: foundComment.body,
			};
		}

		info( 'Comment not found.' );

		return {
			comment_id: '',
			comment_body: '',
		};
	}

	async function deleteComment() {
		const outVars = {
			comment_id: '',
			comment_body: '',
		};

		if ( !commentId ) {
			setFailed( 'Comment ID is required.' );
			return outVars;
		}

		const response = await octokit.rest.issues.deleteComment( {
			owner,
			repo,
			comment_id: commentId,
		} );

		debug( `Delete response: ${inspect( response )}` );
		info( `Deleted a comment. Comment ID: ${commentId}` );

		return {
			comment_id: commentId,
			comment_body: '',
		};
	}

	try {
		const repository = getInput( 'repository' );
		[owner, repo] = repository ? repository.split( '/' ) : process.env.GITHUB_REPOSITORY.split( '/' );

		// Assign variables.
		actionType = getInput( 'type' );
		body = getInput( 'body' );
		issueNumber = getInput( 'number' );
		commentId = getInput( 'comment_id' );
		searchTerm = getInput( 'search_term' );
		direction = getInput( 'direction' );
		author = getInput( 'author' );
		reactions = getInput( 'reactions' );

		let outVars = { comment_id: '', comment_body: '' };

		switch ( actionType ) {
		case 'create':
			outVars = await createComment();
			break;
		case 'update':
		case 'append':
		case 'prepend':
			outVars = await updateComment();
			break;
		case 'find':
			outVars = await findComment();
			break;
		case 'delete':
			outVars = await deleteComment();
			break;
		default:
			break;
		}

		info( `comment_id : ${outVars.comment_id}` );
		info( `comment_body : ${outVars.comment_body}` );

		setOutput( 'comment_id', outVars.comment_id );
		setOutput( 'comment_body', outVars.comment_body );

		// console.log(`Environment : ${inspect(process.env)}`);
		// console.log(`Repository : ${repository}`);
		// console.log(`Owner : ${owner}`);
		// console.log(`Reactions : ${reactions}`);
		// console.log(`Reactions : ${typeof reactions}`);
	} catch ( error ) {
		setFailed( error.message );
	}
}

run();
