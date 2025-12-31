import { Message } from '../model/Message.js';
import { uploadToCloudinary } from '../utils/cloudinary.js';

// @desc    Get all messages for a specific chat
// @route   GET /api/messages/:chatId
// @access  Private
export const allMessages = async (req, res) => {
  try {
    const messages = await Message.find({ chat: req.params.chatId })
      .populate('sender', 'name avatar email role')
      .populate('chat')
      .populate({
        path: 'replyTo',
        select: 'content sender attachments',
        populate: { path: 'sender', select: 'name' }
      });
      
    res.json(messages);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Upload attachment and return URL (Helper for Socket messaging)
// @route   POST /api/messages/upload
// @access  Private
export const uploadMessageAttachments = async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: 'No files uploaded' });
        }

        const uploadPromises = req.files.map(async (file) => {
            const result = await uploadToCloudinary(file.buffer, 'architectural-portal/messages');
            
            let fileType = 'image';
            if (file.mimetype.includes('pdf')) fileType = 'pdf';
            else if (file.mimetype.match(/(word|document)/)) fileType = 'doc';
            else if (file.mimetype.match(/(zip|rar|octet-stream)/)) fileType = 'zip';

            return {
                public_id: result.public_id,
                url: result.secure_url,
                fileType: fileType
            };
        });

        const attachments = await Promise.all(uploadPromises);

        // Return the attachment objects so the Frontend can include them 
        // in the 'message:send' socket emission.
        res.status(200).json(attachments);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Upload failed', error: error.message });
    }
};

// @desc    Mark all messages in a chat as read
// @route   PUT /api/messages/:chatId/read
// @access  Private
export const markAsRead = async (req, res) => {
  try {
    const { chatId } = req.params;

    await Message.updateMany(
      { chat: chatId, readBy: { $ne: req.user._id } },
      { $addToSet: { readBy: req.user._id } }
    );

    res.json({ message: 'Messages marked as read' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};