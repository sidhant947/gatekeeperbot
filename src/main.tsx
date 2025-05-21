import { Devvit } from '@devvit/public-api';

// Configure the app to use Reddit API
Devvit.configure({
  redditAPI: true,
});

// Add settings configuration for minimum account age and custom messages
Devvit.addSettings(

  {
    type: "group",
    label: "Account Age",
    helpText: "Filter Posts/Comments by Account Age Requirements",
    fields: [
      {
        type: 'number',
        name: 'minimum-account-age',
        label: 'Minimum account age (in days) required to post/comment:',
        onValidate: (event) => {
          if (event.value! < 0) {
            return 'Account age must be a positive number';
          }
        }
      },
      {
        type: 'paragraph',
        name: 'removal-message',
        label: 'Custom message to send to users when content is removed:',
        helpText: 'You can use {age} to insert the user\'s account age and {minimum} to insert the minimum required age.'
      },
      {
        type: 'boolean',
        name: 'send-pm',
        label: 'Send a private message to the user when content is removed',
        defaultValue: true
      },
      {
        type: 'boolean',
        name: 'leave-comment',
        label: 'Leave a removal comment when a post is removed',
        defaultValue: false
      }
    ]
  });

// Function to check account age and remove content if needed
async function checkAccountAge(event, context) {
  const { reddit, settings } = context;

  try {
    console.log("Event received:", JSON.stringify(event));

    // Get the settings
    const minimumAccountAge = await settings.get('minimum-account-age') || 30;
    const customMessage = await settings.get('removal-message');
    const sendPM = await settings.get('send-pm');
    const leaveComment = await settings.get('leave-comment');

    console.log(`Using minimum account age: ${minimumAccountAge} days`);

    let content;
    let author;
    let contentType;

    // Determine the type of content and get its data
    if (event.type === 'PostSubmit') {
      contentType = 'post';
      content = event.post;
      author = event.author;
    } else if (event.type === 'CommentSubmit') {
      contentType = 'comment';
      content = event.comment;
      author = event.author;
    } else {
      console.log(`Unsupported event type: ${event.type}`);
      return;
    }

    if (!content || !content.id) {
      console.log(`No content found in event: ${JSON.stringify(event)}`);
      return;
    }

    if (!author || !author.id) {
      console.log(`No author found in event: ${JSON.stringify(event)}`);
      return;
    }

    // Fetch the user to get accurate creation date
    const fetchedAuthor = await reddit.getUserById(author.id);

    // Convert the timestamp to a date
    const createdAtMs = fetchedAuthor.createdAt;
    const createdAt = new Date(createdAtMs);
    const now = new Date();

    // Calculate account age in days
    const millisecondsPerDay = 1000 * 60 * 60 * 24;
    const diffTime = Math.abs(now.getTime() - createdAt.getTime());
    const accountAgeInDays = Math.floor(diffTime / millisecondsPerDay);

    console.log(`User ${author.name} account age: ${accountAgeInDays} days`);

    if (accountAgeInDays < minimumAccountAge) {
      // Get the content object from Reddit API to use its methods
      let contentObj;
      if (contentType === 'post') {
        contentObj = await reddit.getPostById(content.id);
      } else {
        contentObj = await reddit.getCommentById(content.id);
      }

      // Prepare the removal message
      let messageText;
      if (customMessage) {
        // Replace placeholders with actual values
        messageText = customMessage
          .replace(/{age}/g, accountAgeInDays.toString())
          .replace(/{minimum}/g, minimumAccountAge.toString());
      } else {
        // Default message if none is provided
        messageText = `Your ${contentType} has been removed because your account is less than ${minimumAccountAge} days old. Your account is currently ${accountAgeInDays} days old.`;
      }

      // Remove the content
      await contentObj.remove();

      // Send a private message if enabled
      if (sendPM) {
        await reddit.sendPrivateMessage({
          to: author.name,
          subject: `${contentType.charAt(0).toUpperCase() + contentType.slice(1)} removed from r/${event.subreddit.name}`,
          text: messageText,
        });
        console.log(`Sent PM to ${author.name}`);
      }

      // Leave a comment if enabled and it's a post
      if (leaveComment && contentType === 'post') {
        await reddit.submitComment({
          id: content.id,
          text: messageText,
          distinguish: true, // Mark as mod
        });
        console.log(`Left removal comment on post`);
      }

      console.log(`Removed ${contentType} from user with account age of ${accountAgeInDays} days (minimum: ${minimumAccountAge} days).`);
    } else {
      console.log(`User account age (${accountAgeInDays} days) meets the minimum requirement (${minimumAccountAge} days).`);
    }
  } catch (error) {
    console.error("Error in checkAccountAge:", error);
  }
}

// Add triggers for new posts and comments
Devvit.addTrigger({
  event: 'PostSubmit',
  onEvent: checkAccountAge,
});

Devvit.addTrigger({
  event: 'CommentSubmit',
  onEvent: checkAccountAge,
});

export default Devvit;