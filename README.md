# grab-them-comments

Inputs

```
inputs:
  token:
    description: "GitHub token"
    default: ${{ github.token }}
    required: false
  repository:
    description: "The GitHub repository"
    default: ${{ github.repository }}
    required: false
  number:
    description: "The number of the issue or pull request"
    required: false
  search_term:
    description: "Search term, which is included in the comment body."
    required: required
```

Output

```
outputs:
  comment_id:
    description: "The id of the new comment"
  comment_body:
    description: "The body of the new comment"
```